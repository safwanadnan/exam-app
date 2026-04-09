"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface AcademicSession {
    id: string;
    name: string;
    year: number;
    term: string;
}

interface AcademicSessionContextType {
    currentSessionId: string | null;
    setCurrentSessionId: (id: string | null) => void;
    sessions: AcademicSession[];
    isLoading: boolean;
}

const AcademicSessionContext = createContext<AcademicSessionContextType | undefined>(undefined);

export function AcademicSessionProvider({ children }: { children: React.ReactNode }) {
    const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
    const [sessions, setSessions] = useState<AcademicSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial selection from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("currentSessionId");
        if (saved) setCurrentSessionIdState(saved);
        
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/sessions?limit=100");
            const data = await res.json();
            const fetchedSessions = data.sessions || [];
            setSessions(fetchedSessions);
            
            // If no session is selected yet, but we have sessions, default to the first one (most recent)
            const saved = localStorage.getItem("currentSessionId");
            if (!saved && fetchedSessions.length > 0) {
                const defaultId = fetchedSessions[0].id;
                setCurrentSessionIdState(defaultId);
                localStorage.setItem("currentSessionId", defaultId);
            }
        } catch (error) {
            console.error("Failed to fetch academic sessions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const setCurrentSessionId = (id: string | null) => {
        setCurrentSessionIdState(id);
        if (id) {
            localStorage.setItem("currentSessionId", id);
        } else {
            localStorage.removeItem("currentSessionId");
        }
    };

    return (
        <AcademicSessionContext.Provider value={{ currentSessionId, setCurrentSessionId, sessions, isLoading }}>
            {children}
        </AcademicSessionContext.Provider>
    );
}

export function useAcademicSession() {
    const context = useContext(AcademicSessionContext);
    if (context === undefined) {
        throw new Error("useAcademicSession must be used within an AcademicSessionProvider");
    }
    return context;
}
