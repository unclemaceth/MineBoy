export const encode = (obj: any) =>
  JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v));

export const decode = <T=any>(s: string): T =>
  JSON.parse(s);
