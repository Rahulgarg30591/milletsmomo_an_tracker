/** YYYY-MM-DD, as every date in the API is sent. */
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM for month views; rejects month 00 and 13+. */
export const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
