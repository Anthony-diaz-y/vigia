// Recupera tildes y eñes del nombre de archivo, que el formulario multipart entrega leído como latin1
export function decodeFilename(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8')
  return decoded.includes('\uFFFD') ? name : decoded
}
