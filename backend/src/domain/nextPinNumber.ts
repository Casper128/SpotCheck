export function nextPinNumber(pins: readonly { readonly pinNumber: number }[]): number {
  return pins.reduce((maximum, pin) => Math.max(maximum, pin.pinNumber), 0) + 1;
}
