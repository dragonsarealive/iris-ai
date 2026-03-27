import { ulid } from "ulid"
import z from "zod"
import { TaskItemInfo } from "./event"
import { SessionID } from "../session/schema"
import { TeamCoordination } from "./coordination"
import { runPromiseInstance } from "@/effect/runtime"

export namespace TaskList {
  export const CreateInput = z.object({
    teamID: z.string(),
    tasks: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        dependsOn: z.array(z.string()).optional(),
      }),
    ),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export async function create(input: CreateInput): Promise<TaskItemInfo[]> {
    return runPromiseInstance(TeamCoordination.use((r) => r.createTasks(input.teamID, input.tasks)))
  }

  export async function claim(teamID: string, sessionID: SessionID, taskID: string): Promise<TaskItemInfo | null> {
    return runPromiseInstance(TeamCoordination.use((r) => r.claimTask(teamID, sessionID, taskID)))
  }

  export async function complete(taskID: string): Promise<TaskItemInfo | null> {
    return runPromiseInstance(TeamCoordination.use((r) => r.completeTask(taskID)))
  }

  export async function block(taskID: string): Promise<TaskItemInfo | null> {
    return runPromiseInstance(TeamCoordination.use((r) => r.blockTask(taskID)))
  }

  export async function list(teamID: string): Promise<TaskItemInfo[]> {
    return runPromiseInstance(TeamCoordination.use((r) => r.listTasks(teamID)))
  }
}
