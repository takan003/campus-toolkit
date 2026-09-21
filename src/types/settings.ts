export interface Settings {
  systemEnabled: boolean;
  schoolFullName: string;
  schoolShortName: string;
  academicYear: number;
  semester: number;
  copyrightNotice: boolean;
  sponsorAdEnabled: boolean;
  passwordCostFactor: number;
}

export const defaultSettings: Settings = {
  systemEnabled: true,
  schoolFullName: "",
  schoolShortName: "",
  academicYear: new Date().getFullYear() - 1911,
  semester: 1,
  copyrightNotice: true,
  sponsorAdEnabled: false,
  passwordCostFactor: 12,
};
