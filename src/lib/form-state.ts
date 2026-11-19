export type FormState = {
  ok?: string;
  error?: string;
  /** Changes on every submit, so forms can reset after a success. */
  stamp?: number;
};
