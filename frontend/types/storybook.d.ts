declare module "@storybook/react" {
  import type { ComponentType, ReactElement } from "react"

  export type Meta<TArgs = Record<string, unknown>> = {
    title: string
    component: ComponentType<TArgs>
    args?: Partial<TArgs>
    parameters?: Record<string, unknown>
    render?: (args: TArgs) => ReactElement
    tags?: string[]
  }

  export type StoryObj<TArgs = Record<string, unknown>> = {
    name?: string
    args?: Partial<TArgs>
    render?: (args: TArgs) => ReactElement
    parameters?: Record<string, unknown>
  }
}
