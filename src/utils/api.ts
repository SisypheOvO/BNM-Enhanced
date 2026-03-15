export interface BNInfo {
    osuId: number
    username: string
    requestStatus: string[]
    lastOpenedForRequests?: string
    isClosed: boolean
}

export class ApiClient {
    private static cache: Map<number, BNInfo> = new Map()

    static async fetchRelevantInfo(): Promise<Map<number, BNInfo>> {
        try {
            const response = await fetch("https://bn.mappersguild.com/api/relevantInfo")
            const data = await response.json()

            this.cache.clear()

            // traverse the API response to populate the cache
            if (data.allUsersByMode && Array.isArray(data.allUsersByMode)) {
                data.allUsersByMode.forEach((modeGroup: any) => {
                    if (modeGroup.users && Array.isArray(modeGroup.users)) {
                        modeGroup.users.forEach((user: any) => {
                            const isClosed = user.requestStatus?.includes("closed") || false

                            this.cache.set(user.osuId, {
                                osuId: user.osuId,
                                username: user.username,
                                requestStatus: user.requestStatus || [],
                                lastOpenedForRequests: user.lastOpenedForRequests,
                                isClosed: isClosed,
                            })
                        })
                    }
                })
            }

            console.log(`[BNM-Enhanced] Fetched info for ${this.cache.size} users`)
            return this.cache
        } catch (e) {
            console.error("[BNM-Enhanced] Failed to fetch relevant info:", e)
            return this.cache
        }
    }

    static getBNInfo(osuId: number): BNInfo | undefined {
        return this.cache.get(osuId)
    }

    static getCache(): Map<number, BNInfo> {
        return this.cache
    }

    static clearCache() {
        this.cache.clear()
    }
}
