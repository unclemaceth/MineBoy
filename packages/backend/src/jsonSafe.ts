export function jsonReplacer(_key: string, value: any) {
  if (typeof value === 'bigint') return value.toString();
  // ethers BigNumber check
  if (value && typeof value === 'object' && value._isBigNumber) return value.toString();
  // bytes -> hex
  if (value instanceof Uint8Array) return '0x' + Buffer.from(value).toString('hex');
  return value;
}

export function safeStringify(obj: any) {
  return JSON.stringify(obj, jsonReplacer);
}
