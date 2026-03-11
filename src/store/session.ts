import { randomUUID } from 'crypto';
import type { PortfolioData } from '../types/portfolio.js';

interface Session {
    portfolioData: PortfolioData;
    createdAt: Date;
}

// In-memory store keyed by sessionId.
// TODO: swap this Map for a MongoDB-backed store when persistence is needed.
const store = new Map<string, Session>();

export const sessionStore = {
    create(data: PortfolioData): string {
        const sessionId = randomUUID();
        store.set(sessionId, { portfolioData: data, createdAt: new Date() });
        return sessionId;
    },

    get(sessionId: string): PortfolioData | undefined {
        return store.get(sessionId)?.portfolioData;
    },

    update(sessionId: string, data: PortfolioData): boolean {
        const existing = store.get(sessionId);
        if (!existing) return false;
        store.set(sessionId, { ...existing, portfolioData: data });
        return true;
    },

    delete(sessionId: string): void {
        store.delete(sessionId);
    },

    size(): number {
        return store.size;
    },
};
