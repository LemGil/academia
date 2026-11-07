// Tipos mínimos de qrcode-generator (la librería no trae los suyos).
declare module 'qrcode-generator' {
  interface QrCode {
    addData(data: string, mode?: string): void
    make(): void
    getModuleCount(): number
    isDark(row: number, col: number): boolean
  }
  function qrcode(typeNumber: number, errorCorrectionLevel: string): QrCode
  export default qrcode
}
