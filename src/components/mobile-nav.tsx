"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/sidebar"

export function MobileNav() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpen(true)}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
            </Button>

            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => setOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 w-[280px] bg-background border-r shadow-lg">
                        <div className="flex items-center justify-end p-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpen(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <div onClick={() => setOpen(false)}>
                            <Sidebar />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
