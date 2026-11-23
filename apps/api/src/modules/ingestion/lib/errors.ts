export class IngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class UnsupportedFile extends IngestError {
  constructor(readonly reason: string) {
    super(reason)
  }
}

export class FileTooLarge extends IngestError {
  constructor(
    readonly reason: string,
    readonly limit: number,
    readonly actual: number,
  ) {
    super(`${reason}: limit=${limit} actual=${actual}`)
  }
}

export class EmptyFile extends IngestError {
  constructor(message = 'the upload has no data rows') {
    super(message)
  }
}

export class NoUsefulColumns extends IngestError {
  constructor() {
    super(
      'El archivo no tiene columnas utilizables: todas son identificadores o están marcadas como "No usar".',
    )
  }
}

export class SourceConfigError extends IngestError {}
