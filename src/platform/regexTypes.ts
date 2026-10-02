export interface RegexMatch {
  text: string;
  index: number;
  groups: (string | null)[];
  named: Record<string, string | null> | null;
}
