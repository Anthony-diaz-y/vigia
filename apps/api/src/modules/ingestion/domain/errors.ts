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

export class PiiDetected extends IngestError {
  constructor(readonly columns: string[]) {
    super('Upload contains personal-data columns and was rejected: ' + columns.join(', '))
  }
}

export class MissingRequiredColumns extends IngestError {
  constructor(
    readonly missing: string[],
    readonly available: string[],
  ) {
    super(
      'Missing required columns: ' + missing.join(', ') + '. Available: ' + available.join(', '),
    )
  }
}

export class SourceConfigError extends IngestError {}
