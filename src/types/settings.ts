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
  totpEnabled: boolean;
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  cssThemeId: string; // Admin 強制主題
  copyrightNotice: boolean;
  sponsorAdEnabled: boolean;
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
  totpEnabled: false,
  twoFactorEnabled: true,
  sessionTimeout: 10,
  cssThemeId: "",
  copyrightNotice: true,
  sponsorAdEnabled: false,
};
