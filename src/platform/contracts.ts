export type User = { name: string; email: string; groups: string[] };

export type AppEntry = {
  id: string;
  name: string;
  path: string;
  description: string;
  openGroups: string[];
};
