const MAX_SAMPLES = 3

export interface QualityIssue {
  code: string
  message: string
  count: number
  sample: string[]
}

/**
 * Accumulates issues by code, keeping a bounded sample of offending values.
 * Insertion order is the order shown to the user.
 */
export class IssueCollector {
  private readonly messages = new Map<string, string>()
  private readonly counts = new Map<string, number>()
  private readonly samples = new Map<string, string[]>()

  addMany(code: string, message: string, values: readonly string[]): void {
    if (values.length === 0) {
      return
    }
    this.messages.set(code, message)
    this.counts.set(code, (this.counts.get(code) ?? 0) + values.length)
    const sample = this.samples.get(code) ?? []
    for (const value of values) {
      if (sample.length >= MAX_SAMPLES) {
        break
      }
      if (!sample.includes(value)) {
        sample.push(value)
      }
    }
    this.samples.set(code, sample)
  }

  build(): QualityIssue[] {
    return [...this.messages.entries()].map(([code, message]) => ({
      code,
      message,
      count: this.counts.get(code) ?? 0,
      sample: this.samples.get(code) ?? [],
    }))
  }
}
