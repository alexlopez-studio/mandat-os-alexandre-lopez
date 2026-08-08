"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  activeTab: string | undefined
  setActiveTab: (val: string) => void
  layoutId: string
}>({
  activeTab: undefined,
  setActiveTab: () => {},
  layoutId: "",
})

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [activeTab, setActiveTab] = React.useState<string | undefined>(
    value ?? defaultValue
  )
  const layoutId = React.useId()

  const handleValueChange = (val: string) => {
    setActiveTab(val)
    if (onValueChange) onValueChange(val)
  }

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value)
    }
  }, [value])

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, layoutId }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-md p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        pill: "bg-white border border-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-none shadow-sm h-auto data-horizontal:flex-row group-data-horizontal/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { activeTab, layoutId, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      onClick={(e) => {
        setActiveTab(value)
        if (props.onClick) props.onClick(e)
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] border border-transparent px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm dark:group-data-[variant=default]/tabs-list:data-active:border-input dark:group-data-[variant=default]/tabs-list:data-active:bg-input/30",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:shadow-none dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:py-2 group-data-[variant=pill]/tabs-list:rounded-xl group-data-[variant=pill]/tabs-list:text-xs group-data-[variant=pill]/tabs-list:font-bold group-data-[variant=pill]/tabs-list:text-slate-500 hover:group-data-[variant=pill]/tabs-list:text-slate-800 group-data-[variant=pill]/tabs-list:data-active:text-slate-800 group-data-[variant=pill]/tabs-list:data-active:bg-transparent group-data-[variant=pill]/tabs-list:data-active:shadow-none group-data-[variant=pill]/tabs-list:h-auto",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children}</span>
      {isActive && (
        <motion.div
          layoutId={`activeTab-${layoutId}`}
          className="absolute inset-0 bg-slate-100 rounded-xl hidden group-data-[variant=pill]/tabs-list:block"
          style={{ zIndex: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
        />
      )}
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
