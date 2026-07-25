export const sleep = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
