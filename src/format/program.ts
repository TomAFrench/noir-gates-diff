import colors from "colors";
import _sortBy from "lodash/sortBy";

import { DiffCell, DiffProgram } from "../types";

export enum TextAlign {
  LEFT = "left",
  RIGHT = "right",
  CENTER = "center",
}

const center = (text: string, length: number) =>
  text.padStart((text.length + length) / 2).padEnd(length);

export const formatShellCell = (cell: DiffCell, length = 10) => {
  const format = colors[cell.delta > 0 ? "red" : cell.delta < 0 ? "green" : "reset"];

  return [
    cell.current.toLocaleString().padStart(length) +
      " " +
      format(("(" + (plusSign(cell.delta) + cell.delta.toLocaleString()) + ")").padEnd(length)),
    colors.bold(
      format(
        (
          plusSign(cell.prcnt) +
          (cell.prcnt === Infinity ? "∞" : cell.prcnt.toFixed(2)) +
          "%"
        ).padStart(9)
      )
    ),
  ];
};

const selectSummaryDiffs = (
  diffs: DiffProgram[],
  minCircuitChangePercentage: number
): DiffProgram[] =>
  diffs.filter(
    (method) =>
      Math.abs(method.circuit_size.prcnt) >= minCircuitChangePercentage &&
      (method.acir_opcodes.delta !== 0 || method.circuit_size.delta !== 0)
  );

export const formatShellDiff = (diffs: DiffProgram[], summaryQuantile = 0.8) => {
  const maxProgramLength = Math.max(8, ...diffs.map(({ name }) => name.length));

  const SHELL_SUMMARY_COLS = [
    { txt: "", length: 0 },
    { txt: "Program", length: maxProgramLength },
    { txt: "ACIR opcodes (+/-)", length: 33 },
    { txt: "Circuit size (+/-)", length: 33 },
    { txt: "", length: 0 },
  ];

  const SHELL_DIFF_COLS = [
    { txt: "", length: 0 },
    { txt: "Program", length: maxProgramLength },
    { txt: "ACIR opcodes (+/-)", length: 33 },
    { txt: "Circuit size (+/-)", length: 33 },
    { txt: "", length: 0 },
  ];

  const summaryHeader = SHELL_SUMMARY_COLS.map((entry) =>
    colors.bold(center(entry.txt, entry.length || 0))
  )
    .join(" | ")
    .trim();
  const summarySeparator = SHELL_SUMMARY_COLS.map(({ length }) =>
    length > 0 ? "-".repeat(length + 2) : ""
  )
    .join("|")
    .trim();

  const diffHeader = SHELL_DIFF_COLS.map((entry) =>
    colors.bold(center(entry.txt, entry.length || 0))
  )
    .join(" | ")
    .trim();
  const diffSeparator = SHELL_DIFF_COLS.map(({ length }) =>
    length > 0 ? "-".repeat(length + 2) : ""
  )
    .join("|")
    .trim();

  const sortedPrograms = _sortBy(diffs, (method) => Math.abs(method.circuit_size.prcnt));
  const circuitChangeQuantile = Math.abs(
    sortedPrograms[Math.floor((sortedPrograms.length - 1) * summaryQuantile)]?.circuit_size.prcnt ??
      0
  );

  return (
    colors.underline(
      colors.bold(
        colors.yellow(
          `🧾 Summary (${Math.round((1 - summaryQuantile) * 100)}% most significant diffs)\n\n`
        )
      )
    ) +
    [
      "",
      summaryHeader,
      ...selectSummaryDiffs(diffs, circuitChangeQuantile).map((diff) =>
        [
          "",
          colors.bold(colors.grey(diff.name.padEnd(maxProgramLength))),
          ...formatShellCell(diff.acir_opcodes),
          ...formatShellCell(diff.circuit_size),
          "",
        ]
          .join(" | ")
          .trim()
      ),
      "",
    ]
      .join(`\n${summarySeparator}\n`)
      .trim() +
    colors.underline(colors.bold(colors.yellow("\n\nFull diff report 👇\n\n"))) +
    [
      "",
      diffHeader,
      ...diffs.map((diff) =>
        [
          "",
          colors.bold(colors.grey(diff.name.padEnd(maxProgramLength))),
          ...formatShellCell(diff.acir_opcodes),
          ...formatShellCell(diff.circuit_size),
          "",
        ]
          .join(" | ")
          .trim()
      ),
      "",
    ]
      .join(`\n${diffSeparator}\n`)
      .trim()
  );
};

const plusSign = (num: number) => (num > 0 ? "+" : "");

const alignPattern = (align = TextAlign.LEFT) => {
  switch (align) {
    case TextAlign.LEFT:
      return ":-";
    case TextAlign.RIGHT:
      return "-:";
    case TextAlign.CENTER:
      return ":-:";
  }
};

const formatMarkdownSummaryCell = (rows: DiffCell[]) => [
  rows
    .map(
      (row) =>
        plusSign(row.delta) +
        row.delta.toLocaleString() +
        " " +
        (row.delta > 0 ? "❌" : row.delta < 0 ? "✅" : "➖")
    )
    .join("<br />"),
  rows
    .map(
      (row) =>
        "**" + plusSign(row.prcnt) + (row.prcnt === Infinity ? "∞" : row.prcnt.toFixed(2)) + "%**"
    )
    .join("<br />"),
];

const formatMarkdownFullCell = (rows: DiffCell[]): string[] => [
  rows
    .map(
      (row) =>
        row.current.toLocaleString() +
        "&nbsp;(" +
        plusSign(row.delta) +
        row.delta.toLocaleString() +
        ")"
    )
    .join("<br />"),
  rows
    .map(
      (row) =>
        "**" + plusSign(row.prcnt) + (row.prcnt === Infinity ? "∞" : row.prcnt.toFixed(2)) + "%**"
    )
    .join("<br />"),
];

const MARKDOWN_SUMMARY_COLS = [
  { txt: "" },
  { txt: "Program", align: TextAlign.LEFT },
  { txt: "ACIR opcodes (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Circuit size (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "" },
];

const MARKDOWN_DIFF_COLS = [
  { txt: "" },
  { txt: "Program", align: TextAlign.LEFT },
  { txt: "ACIR opcodes (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "Circuit size (+/-)", align: TextAlign.RIGHT },
  { txt: "%", align: TextAlign.RIGHT },
  { txt: "" },
];

export const formatMarkdownDiff = (
  header: string,
  diffs: DiffProgram[],
  repository: string,
  commitHash: string,
  refCommitHash?: string,
  summaryQuantile = 0.8
) => {
  const diffReport = [
    header,
    "",
    `> Generated at commit: [${commitHash}](/${repository}/commit/${commitHash})` +
      (refCommitHash
        ? `, compared to commit: [${refCommitHash}](/${repository}/commit/${refCommitHash})`
        : ""),
  ];
  if (diffs.length === 0)
    return diffReport.concat(["", "### There are no changes in circuit sizes"]).join("\n").trim();

  const summaryHeader = MARKDOWN_SUMMARY_COLS.map((entry) => entry.txt)
    .join(" | ")
    .trim();
  const summaryHeaderSeparator = MARKDOWN_SUMMARY_COLS.map((entry) =>
    entry.txt ? alignPattern(entry.align) : ""
  )
    .join("|")
    .trim();

  const diffHeader = MARKDOWN_DIFF_COLS.map((entry) => entry.txt)
    .join(" | ")
    .trim();
  const diffHeaderSeparator = MARKDOWN_DIFF_COLS.map((entry) =>
    entry.txt ? alignPattern(entry.align) : ""
  )
    .join("|")
    .trim();

  const sortedMethods = _sortBy(diffs, (program) => Math.abs(program.circuit_size.prcnt));
  const circuitChangeQuantile = Math.abs(
    sortedMethods[Math.floor((sortedMethods.length - 1) * summaryQuantile)]?.circuit_size.prcnt ?? 0
  );

  return diffReport
    .concat([
      "",
      `### 🧾 Summary (${Math.round((1 - summaryQuantile) * 100)}% most significant diffs)`,
      "",
      summaryHeader,
      summaryHeaderSeparator,
      ...selectSummaryDiffs(diffs, circuitChangeQuantile).flatMap((diff) =>
        [
          "",
          `**${diff.name}**`,
          ...formatMarkdownSummaryCell([diff.acir_opcodes]),
          ...formatMarkdownSummaryCell([diff.circuit_size]),
          "",
        ]
          .join(" | ")
          .trim()
      ),
      "---",
      "",
      "<details>",
      "<summary><strong>Full diff report</strong> 👇</summary>",
      "<br />",
      "",
      diffHeader,
      diffHeaderSeparator,
      diffs
        .flatMap((diff) =>
          [
            "",
            `**${diff.name}**`,
            ...formatMarkdownFullCell([diff.acir_opcodes]),
            ...formatMarkdownFullCell([diff.circuit_size]),
            "",
          ]
            .join(" | ")
            .trim()
        )
        .join("\n"),
      "</details>",
      "",
    ])
    .join("\n")
    .trim();
};
