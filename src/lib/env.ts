function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  databaseUrl: () => required("DATABASE_URL"),
  kekFile: () => required("KEK_FILE"),
  companyDomain: () => required("COMPANY_DOMAIN"),
};
