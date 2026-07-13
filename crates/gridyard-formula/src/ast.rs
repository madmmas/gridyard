//! Arena-backed formula AST.
//!
//! Nodes live in a [`SlotMap`] so parsers and later evaluators avoid
//! per-node `Box` churn — see `docs/01-grid-engine-core-spec.md`.

use std::fmt;

use gridyard_core::CellId;
use slotmap::{new_key_type, SlotMap};

new_key_type! {
    /// Stable handle to an expression node inside an [`Ast`] arena.
    pub struct NodeId;
}

/// Binary arithmetic operators recognized by the v0.1 parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BinOp {
    /// Addition (`+`).
    Add,
    /// Subtraction (`-`).
    Sub,
    /// Multiplication (`*`).
    Mul,
    /// Division (`/`).
    Div,
}

/// Unary operators recognized by the v0.1 parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum UnaryOp {
    /// Unary plus (`+x`).
    Pos,
    /// Unary minus (`-x`).
    Neg,
}

/// One expression node in the formula AST.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    /// Numeric literal.
    Number(f64),
    /// String literal (`"hello"`).
    Text(String),
    /// Boolean literal (`TRUE` / `FALSE`).
    Bool(bool),
    /// Single cell reference (`A1`).
    CellRef(CellId),
    /// Inclusive cell range (`A1:A8`).
    Range {
        /// Start corner of the range.
        start: CellId,
        /// End corner of the range.
        end: CellId,
    },
    /// Function call (`SUM(1, 2)`).
    Call {
        /// Function name as written (letter case preserved).
        name: String,
        /// Argument expressions, in order.
        args: Vec<NodeId>,
    },
    /// Unary operator applied to a child node.
    Unary {
        /// Operator.
        op: UnaryOp,
        /// Operand node.
        expr: NodeId,
    },
    /// Binary operator applied to two child nodes.
    Binary {
        /// Operator.
        op: BinOp,
        /// Left operand.
        left: NodeId,
        /// Right operand.
        right: NodeId,
    },
}

/// A parsed formula: an arena of [`Expr`] nodes plus the root handle.
#[derive(Debug, Clone)]
pub struct Ast {
    nodes: SlotMap<NodeId, Expr>,
    root: NodeId,
}

impl Ast {
    /// Creates an AST from an arena and root node.
    pub(crate) fn from_parts(nodes: SlotMap<NodeId, Expr>, root: NodeId) -> Self {
        Self { nodes, root }
    }

    /// Handle of the root expression.
    pub fn root(&self) -> NodeId {
        self.root
    }

    /// Borrows the expression at `id`.
    pub fn node(&self, id: NodeId) -> &Expr {
        &self.nodes[id]
    }

    /// Fully parenthesized rendering, useful for precedence tests.
    ///
    /// Cell refs are shown as packed `CellId` values (`r{row}c{col}`) so
    /// tests do not depend on an A1 formatter.
    pub fn parenthesized(&self) -> String {
        self.format_node(self.root)
    }

    fn format_node(&self, id: NodeId) -> String {
        match self.node(id) {
            Expr::Number(n) => format_number(*n),
            Expr::Text(s) => format!("\"{s}\""),
            Expr::Bool(true) => "TRUE".to_string(),
            Expr::Bool(false) => "FALSE".to_string(),
            Expr::CellRef(cell) => format_cell(*cell),
            Expr::Range { start, end } => {
                format!("{}:{}", format_cell(*start), format_cell(*end))
            }
            Expr::Call { name, args } => {
                let joined = args
                    .iter()
                    .map(|a| self.format_node(*a))
                    .collect::<Vec<_>>()
                    .join(",");
                format!("{name}({joined})")
            }
            Expr::Unary { op, expr } => {
                let op = match op {
                    UnaryOp::Pos => '+',
                    UnaryOp::Neg => '-',
                };
                format!("({op}{})", self.format_node(*expr))
            }
            Expr::Binary { op, left, right } => {
                let op = match op {
                    BinOp::Add => '+',
                    BinOp::Sub => '-',
                    BinOp::Mul => '*',
                    BinOp::Div => '/',
                };
                format!(
                    "({}{}{})",
                    self.format_node(*left),
                    op,
                    self.format_node(*right)
                )
            }
        }
    }
}

fn format_number(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{n}")
    }
}

fn format_cell(id: CellId) -> String {
    let (row, col) = gridyard_core::unpack_cell_id(id);
    format!("r{row}c{col}")
}

impl fmt::Display for Ast {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.parenthesized())
    }
}

impl PartialEq for Ast {
    fn eq(&self, other: &Self) -> bool {
        self.parenthesized() == other.parenthesized()
    }
}

impl Eq for Ast {}
