export interface Settings {
  systemEnabled: boolean;
  systemName: string;
  schoolFullName: string;
  schoolShortName: string;
  schoolOtherNames: string;
  academicYear: number;
  schoolCode: string;
  contactPerson: string;
  contactEmail: string;
  oauthEnabled: boolean;
  oauthClientId: string;
  semester: number;
  copyrightNotice: boolean;
  sponsorAdEnabled: boolean;
  passwordCostFactor: number;
}

export const defaultSettings: Settings = {
  systemEnabled: true,
  systemName: "",
  schoolFullName: "",
  schoolShortName: "",
  schoolOtherNames: "",
  academicYear: new Date().getFullYear() - 1911,
  schoolCode: "",
  contactPerson: "",
  contactEmail: "",
  oauthEnabled: false,
  oauthClientId: "",
  semester: 1,
  copyrightNotice: true,
  sponsorAdEnabled: false,
  passwordCostFactor: 12,
};
