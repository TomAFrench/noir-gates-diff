import _orderBy from "lodash/orderBy";

import {
  ContractDiffReport,
  ContractReport,
  DiffProgram,
  CircuitReport,
  WorkspaceDiffReport,
  WorkspaceReport,
  ProgramReport,
} from "./types";

export const variation = (current: number, previous: number) => {
  const delta = current - previous;

  return {
    previous,
    current,
    delta,
    percentage: previous !== 0 ? (100 * delta) / previous : Infinity,
  };
};

export const loadReports = (content: string): WorkspaceReport => {
  return JSON.parse(content);
};

export const computedWorkspaceDiff = (
  sourceReport: WorkspaceReport,
  compareReport: WorkspaceReport
): WorkspaceDiffReport => ({
  programs: computeProgramDiffs(sourceReport.programs, compareReport.programs),
  contracts: computeContractDiffs(sourceReport.contracts, compareReport.contracts),
});

export const computeProgramDiffs = (
  sourceReports: ProgramReport[],
  compareReports: ProgramReport[]
): DiffProgram[] => {
  const sourceReportNames = sourceReports.map((report) => report.package_name);
  const commonReportNames = compareReports
    .map((report) => report.package_name)
    .filter((name) => sourceReportNames.includes(name));

  return commonReportNames
    .map((reportName) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const srcReport = sourceReports.find((report) => report.package_name == reportName)!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cmpReport = compareReports.find((report) => report.package_name == reportName)!;

      // For now we fetch just the main of each program
      return computeCircuitDiff(srcReport.functions[0], cmpReport.functions[0], reportName);
    })
    .filter((diff) => !isEmptyDiff(diff))
    .sort(
      (diff1, diff2) =>
        Math.max(diff2.circuit_size.percentage) - Math.max(diff1.circuit_size.percentage)
    );
};

const computeCircuitDiff = (
  sourceReport: CircuitReport,
  compareReport: CircuitReport,
  // We want the name of the package that represents the entire program in our report
  reportName: string
): DiffProgram => {
  return {
    name: reportName,
    acir_opcodes: variation(compareReport.acir_opcodes, sourceReport.acir_opcodes),
    circuit_size: variation(compareReport.circuit_size, sourceReport.circuit_size),
  };
};

const isEmptyDiff = (diff: DiffProgram): boolean =>
  diff.acir_opcodes.delta === 0 && diff.circuit_size.delta === 0;

export const computeContractDiffs = (
  sourceReports: ContractReport[],
  compareReports: ContractReport[]
): ContractDiffReport[] => {
  const sourceReportNames = sourceReports.map((report) => report.name);
  const commonReportNames = compareReports
    .map((report) => report.name)
    .filter((name) => sourceReportNames.includes(name));

  return commonReportNames
    .map((reportName) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const srcReport = sourceReports.find((report) => report.name == reportName)!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cmpReport = compareReports.find((report) => report.name == reportName)!;

      return computeContractDiff(srcReport, cmpReport);
    })
    .filter((diff) => diff.functions.length > 0)
    .sort(
      (diff1, diff2) =>
        Math.max(
          ...diff2.functions.map((functionDiff) => Math.abs(functionDiff.circuit_size.percentage))
        ) -
        Math.max(
          ...diff1.functions.map((functionDiff) => Math.abs(functionDiff.circuit_size.percentage))
        )
    );
};

const computeContractDiff = (
  sourceReport: ContractReport,
  compareReport: ContractReport
): ContractDiffReport => {
  // TODO(https://github.com/noir-lang/noir/issues/4720): Settle on how to display contract functions with non-inlined Acir calls
  // Right now we assume each contract function does not have non-inlined functions.
  // Thus, we simply re-assign each `CircuitReport` to a `ProgramReport` to easily reuse `computeProgramDiffs`
  const sourceFunctionsAsProgram = sourceReport.functions.map((func) => {
    const programReport: ProgramReport = {
      package_name: func.name,
      functions: [func],
    };
    return programReport;
  });
  const compareFunctionsAsProgram = compareReport.functions.map((func) => {
    const programReport: ProgramReport = {
      package_name: func.name,
      functions: [func],
    };
    return programReport;
  });
  const functionDiffs = computeProgramDiffs(sourceFunctionsAsProgram, compareFunctionsAsProgram);

  return {
    name: sourceReport.name,
    functions: functionDiffs,
  };
};
