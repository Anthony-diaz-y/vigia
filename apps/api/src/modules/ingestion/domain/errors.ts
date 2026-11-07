/** Rejected or unprocessable upload. The message is user-facing and Spanish-compatible. */
export class IngestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** The file format is not accepted (legacy formats, macro-enabled workbooks). */
export class UnsupportedFile extends IngestError {
  constructor(readonly reason: string) {
    super(reason)
  }
}

/** The upload exceeds the configured size, row or column budget. */
export class FileTooLarge extends IngestError {
  constructor(
    readonly reason: string,
    readonly limit: number,
    readonly actual: number,
  ) {
    super(`${reason}: limit=${limit} actual=${actual}`)
  }
}

/** The file has no data rows. */
export class EmptyFile extends IngestError {
  constructor(message = 'the upload has no data rows') {
    super(message)
  }
}

/** Personal-data columns were detected; the upload is refused before storage. */
export class PiiDetected extends IngestError {
  constructor(readonly columns: string[]) {
    super('Upload contains personal-data columns and was rejected: ' + columns.join(', '))
  }
}

/** Required canonical columns could not be resolved from the source headers. */
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

/** The per-source mapping configuration is missing or malformed. */
export class SourceConfigError extends IngestError {}
