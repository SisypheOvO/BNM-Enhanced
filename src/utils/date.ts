export class DateUtils {
    static parseOsuDate(dateStr: string): Date | null {
        try {
            const date = new Date(dateStr)
            return isNaN(date.getTime()) ? null : date
        } catch {
            return null
        }
    }

    static daysSince(date: Date): number {
        const now = new Date()
        const diffTime = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        return Math.max(0, diffDays) // insure non-negative
    }

    static formatDate(dateStr: string): string {
        const date = this.parseOsuDate(dateStr)
        if (!date) return "Unknown"

        const days = this.daysSince(date)
        return `${days} days ago (${date.toLocaleDateString()})`
    }
}
