//! Dependency edges, dirty-marking, and topological order.
//!
//! Edge direction: precedent → dependent (if `B` has `=A1`, then `A1 → B`).

use std::collections::{HashMap, HashSet, VecDeque};

use gridyard_core::CellId;

/// Sparse dependency graph keyed by [`CellId`].
#[derive(Debug, Clone, Default)]
pub struct DepGraph {
    /// `cell → cells it reads`.
    precedents: HashMap<CellId, HashSet<CellId>>,
    /// `cell → cells that read it`.
    dependents: HashMap<CellId, HashSet<CellId>>,
    /// Cells pending recalculation.
    dirty: HashSet<CellId>,
}

impl DepGraph {
    /// Creates an empty graph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Replaces the precedent set for `cell` and rebuilds reverse edges.
    pub fn set_precedents(
        &mut self,
        cell: CellId,
        new_precedents: impl IntoIterator<Item = CellId>,
    ) {
        self.clear_precedents(cell);
        let set: HashSet<CellId> = new_precedents.into_iter().collect();
        if set.is_empty() {
            return;
        }
        for &p in &set {
            self.dependents.entry(p).or_default().insert(cell);
        }
        self.precedents.insert(cell, set);
    }

    /// Removes all dependency edges for `cell` as a formula consumer.
    pub fn clear_precedents(&mut self, cell: CellId) {
        if let Some(old) = self.precedents.remove(&cell) {
            for p in old {
                if let Some(deps) = self.dependents.get_mut(&p) {
                    deps.remove(&cell);
                    if deps.is_empty() {
                        self.dependents.remove(&p);
                    }
                }
            }
        }
    }

    /// Marks `cell` and all transitive dependents dirty.
    pub fn mark_dirty(&mut self, cell: CellId) {
        let mut stack = vec![cell];
        while let Some(id) = stack.pop() {
            if !self.dirty.insert(id) {
                continue;
            }
            if let Some(deps) = self.dependents.get(&id) {
                stack.extend(deps.iter().copied());
            }
        }
    }

    /// Returns whether `cell` is currently dirty.
    pub fn is_dirty(&self, cell: CellId) -> bool {
        self.dirty.contains(&cell)
    }

    /// Number of dirty cells.
    pub fn dirty_len(&self) -> usize {
        self.dirty.len()
    }

    /// Clears the dirty set without recalculating.
    pub fn clear_dirty(&mut self) {
        self.dirty.clear();
    }

    /// Topologically sorts the dirty subset.
    ///
    /// Returns `Ok(order)` where precedents appear before dependents.
    /// Returns `Err(cycle_cells)` when the dirty subgraph contains a cycle;
    /// those cells (and any dirty cells that remain unreachable via Kahn)
    /// are listed so callers can mark them [`gridyard_core::ErrorKind::Circular`].
    pub fn take_dirty_order(&mut self) -> Result<Vec<CellId>, Vec<CellId>> {
        let dirty: HashSet<CellId> = self.dirty.drain().collect();
        if dirty.is_empty() {
            return Ok(Vec::new());
        }

        // indegree among dirty nodes: edge P→D when D is dirty and P is a
        // precedent of D that is also dirty.
        let mut indegree: HashMap<CellId, usize> = dirty.iter().map(|&c| (c, 0)).collect();
        let mut forward: HashMap<CellId, Vec<CellId>> = HashMap::new();

        for &d in &dirty {
            if let Some(preds) = self.precedents.get(&d) {
                for &p in preds {
                    if dirty.contains(&p) {
                        *indegree.entry(d).or_default() += 1;
                        forward.entry(p).or_default().push(d);
                    }
                }
            }
        }

        let mut queue: VecDeque<CellId> = indegree
            .iter()
            .filter_map(|(&c, &deg)| if deg == 0 { Some(c) } else { None })
            .collect();
        // Stable-ish order for tests: sort the initial queue.
        let mut initial: Vec<CellId> = queue.drain(..).collect();
        initial.sort_unstable();
        queue.extend(initial);

        let mut order = Vec::with_capacity(dirty.len());
        while let Some(n) = queue.pop_front() {
            order.push(n);
            if let Some(children) = forward.get(&n) {
                let mut next = Vec::new();
                for &c in children {
                    if let Some(deg) = indegree.get_mut(&c) {
                        *deg -= 1;
                        if *deg == 0 {
                            next.push(c);
                        }
                    }
                }
                next.sort_unstable();
                queue.extend(next);
            }
        }

        if order.len() == dirty.len() {
            Ok(order)
        } else {
            let mut cyclic: Vec<CellId> =
                dirty.into_iter().filter(|c| !order.contains(c)).collect();
            cyclic.sort_unstable();
            Err(cyclic)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gridyard_core::cell_id;

    #[test]
    fn mark_dirty_is_transitive() {
        let mut g = DepGraph::new();
        let a = cell_id(0, 0);
        let b = cell_id(0, 1);
        let c = cell_id(0, 2);
        g.set_precedents(b, [a]);
        g.set_precedents(c, [b]);
        g.mark_dirty(a);
        assert!(g.is_dirty(a) && g.is_dirty(b) && g.is_dirty(c));
        assert_eq!(g.dirty_len(), 3);
    }

    #[test]
    fn topo_orders_chain() {
        let mut g = DepGraph::new();
        let a = cell_id(0, 0);
        let b = cell_id(0, 1);
        let c = cell_id(0, 2);
        g.set_precedents(b, [a]);
        g.set_precedents(c, [b]);
        g.mark_dirty(a);
        let order = g.take_dirty_order().expect("acyclic");
        assert_eq!(order, vec![a, b, c]);
    }

    #[test]
    fn detects_cycle() {
        let mut g = DepGraph::new();
        let a = cell_id(0, 0);
        let b = cell_id(0, 1);
        g.set_precedents(a, [b]);
        g.set_precedents(b, [a]);
        g.mark_dirty(a);
        let cyclic = g.take_dirty_order().expect_err("cycle");
        assert_eq!(cyclic, vec![a, b]);
    }
}
