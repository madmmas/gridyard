//! Bounded undo/redo stack for single-cell edits.
//!
//! See `docs/01-grid-engine-core-spec.md` (Undo): each edit is a command with
//! an inverse, not a full sheet snapshot.

use std::collections::VecDeque;

use gridyard_core::CellId;

/// Default maximum number of undo steps kept in memory.
pub const DEFAULT_UNDO_LIMIT: usize = 100;

/// One single-cell edit: enough to revert or re-apply via `set_cell`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CellEditCommand {
    /// Cell that was edited.
    pub cell: CellId,
    /// Raw input before the edit (literal or `=formula`, or `""` if empty).
    pub old_input: String,
    /// Raw input after the edit (as stored by the engine).
    pub new_input: String,
}

/// Undo/redo history for single-cell edits.
///
/// Pushing a new command clears the redo stack (linear history, not a
/// branching undo tree). When the undo stack exceeds [`Self::limit`], the
/// oldest entries are dropped.
#[derive(Debug, Clone)]
pub struct UndoStack {
    undo: VecDeque<CellEditCommand>,
    redo: VecDeque<CellEditCommand>,
    limit: usize,
}

impl Default for UndoStack {
    fn default() -> Self {
        Self::with_limit(DEFAULT_UNDO_LIMIT)
    }
}

impl UndoStack {
    /// Creates a stack with [`DEFAULT_UNDO_LIMIT`] (100) entries.
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a stack that keeps at most `limit` undo entries.
    ///
    /// A limit of `0` means history is never retained (every `push` is a
    /// no-op after clearing redo).
    pub fn with_limit(limit: usize) -> Self {
        Self {
            undo: VecDeque::new(),
            redo: VecDeque::new(),
            limit,
        }
    }

    /// Maximum undo depth for this stack.
    pub fn limit(&self) -> usize {
        self.limit
    }

    /// Number of commands currently available to undo.
    pub fn undo_len(&self) -> usize {
        self.undo.len()
    }

    /// Number of commands currently available to redo.
    pub fn redo_len(&self) -> usize {
        self.redo.len()
    }

    /// Returns `true` when [`Self::undo`] would return a command.
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    /// Returns `true` when [`Self::redo`] would return a command.
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// Clears both undo and redo stacks.
    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
    }

    /// Records a new edit. Clears redo; evicts from the front if over limit.
    ///
    /// No-ops when `old_input == new_input` or when `limit` is `0`.
    pub fn push(&mut self, command: CellEditCommand) {
        if command.old_input == command.new_input {
            return;
        }
        self.redo.clear();
        if self.limit == 0 {
            return;
        }
        self.undo.push_back(command);
        while self.undo.len() > self.limit {
            self.undo.pop_front();
        }
    }

    /// Pops the latest edit for undo and parks it on the redo stack.
    ///
    /// The caller should apply [`CellEditCommand::old_input`] to
    /// [`CellEditCommand::cell`].
    pub fn undo(&mut self) -> Option<CellEditCommand> {
        let command = self.undo.pop_back()?;
        self.redo.push_back(command.clone());
        Some(command)
    }

    /// Pops the latest undone edit for redo and parks it back on undo.
    ///
    /// The caller should apply [`CellEditCommand::new_input`] to
    /// [`CellEditCommand::cell`].
    pub fn redo(&mut self) -> Option<CellEditCommand> {
        let command = self.redo.pop_back()?;
        self.undo.push_back(command.clone());
        Some(command)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::cell_id;

    fn edit(cell: &str, old: &str, new: &str) -> CellEditCommand {
        let bytes = cell.as_bytes();
        let mut i = 0;
        while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        let mut col: u32 = 0;
        for ch in cell[..i].chars() {
            col = col * 26 + u32::from(ch.to_ascii_uppercase() as u8 - b'A') + 1;
        }
        let row: u32 = cell[i..].parse().expect("row");
        CellEditCommand {
            cell: cell_id(row - 1, col - 1),
            old_input: old.into(),
            new_input: new.into(),
        }
    }

    #[test]
    fn undo_redo_chain_restores_inputs() {
        let mut stack = UndoStack::new();
        stack.push(edit("A1", "", "1"));
        stack.push(edit("A1", "1", "2"));
        stack.push(edit("B1", "", "=A1+1"));

        let u1 = stack.undo().expect("undo B1");
        assert_eq!(u1.old_input, "");
        assert_eq!(u1.new_input, "=A1+1");

        let u2 = stack.undo().expect("undo A1→2");
        assert_eq!((u2.old_input.as_str(), u2.new_input.as_str()), ("1", "2"));

        let r1 = stack.redo().expect("redo A1→2");
        assert_eq!((r1.old_input.as_str(), r1.new_input.as_str()), ("1", "2"));
        assert!(stack.can_redo());
        assert!(stack.can_undo());
    }

    #[test]
    fn new_edit_after_undo_clears_redo() {
        let mut stack = UndoStack::new();
        stack.push(edit("A1", "", "1"));
        stack.push(edit("A1", "1", "2"));
        assert!(stack.undo().is_some());
        assert!(stack.can_redo());

        stack.push(edit("A1", "1", "9"));
        assert!(!stack.can_redo());
        assert_eq!(stack.undo_len(), 2);

        let last = stack.undo().expect("undo 9");
        assert_eq!(last.new_input, "9");
        assert_eq!(last.old_input, "1");
    }

    #[test]
    fn identical_old_and_new_are_not_recorded() {
        let mut stack = UndoStack::new();
        stack.push(edit("A1", "x", "x"));
        assert!(!stack.can_undo());
    }

    #[test]
    fn bounded_history_evicts_oldest() {
        let mut stack = UndoStack::with_limit(2);
        stack.push(edit("A1", "", "1"));
        stack.push(edit("A1", "1", "2"));
        stack.push(edit("A1", "2", "3"));
        assert_eq!(stack.undo_len(), 2);

        let first_undo = stack.undo().expect("3→2");
        assert_eq!(first_undo.old_input, "2");
        let second_undo = stack.undo().expect("2→1");
        assert_eq!(second_undo.old_input, "1");
        // Oldest ""→"1" was evicted; cannot undo further.
        assert!(stack.undo().is_none());
    }

    #[test]
    fn zero_limit_never_retains_history() {
        let mut stack = UndoStack::with_limit(0);
        stack.push(edit("A1", "", "1"));
        assert!(!stack.can_undo());
        assert!(!stack.can_redo());
    }

    #[test]
    fn table_driven_undo_redo_paths() {
        #[derive(Clone, Copy)]
        enum Step {
            Push(&'static str, &'static str, &'static str),
            Undo(&'static str),
            Redo(&'static str),
            AssertUndoLen(usize),
            AssertRedoLen(usize),
        }

        let cases: &[&[Step]] = &[
            &[
                Step::Push("A1", "", "a"),
                Step::Push("A1", "a", "b"),
                Step::AssertUndoLen(2),
                Step::Undo("a"),
                Step::AssertRedoLen(1),
                Step::Redo("b"),
                Step::AssertRedoLen(0),
            ],
            &[
                Step::Push("A1", "", "1"),
                Step::Undo(""),
                Step::Push("A1", "", "z"),
                Step::AssertRedoLen(0),
                Step::AssertUndoLen(1),
            ],
        ];

        for (case_idx, steps) in cases.iter().enumerate() {
            let mut stack = UndoStack::new();
            for (step_idx, step) in steps.iter().enumerate() {
                match *step {
                    Step::Push(cell, old, new) => stack.push(edit(cell, old, new)),
                    Step::Undo(expected_old) => {
                        let cmd = stack.undo().unwrap_or_else(|| {
                            panic!("case {case_idx} step {step_idx}: expected undo")
                        });
                        assert_eq!(
                            cmd.old_input, expected_old,
                            "case {case_idx} step {step_idx}"
                        );
                    }
                    Step::Redo(expected_new) => {
                        let cmd = stack.redo().unwrap_or_else(|| {
                            panic!("case {case_idx} step {step_idx}: expected redo")
                        });
                        assert_eq!(
                            cmd.new_input, expected_new,
                            "case {case_idx} step {step_idx}"
                        );
                    }
                    Step::AssertUndoLen(n) => {
                        assert_eq!(stack.undo_len(), n, "case {case_idx} step {step_idx}");
                    }
                    Step::AssertRedoLen(n) => {
                        assert_eq!(stack.redo_len(), n, "case {case_idx} step {step_idx}");
                    }
                }
            }
        }
    }
}
