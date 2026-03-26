import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import { SessionID } from "@/session/schema"
import z from "zod"
import { TeamModule } from "../../team"
import { TaskList } from "../../team/task"
import { TeamMessage } from "../../team/message"
import { PlanApproval } from "../../team/plan"
import { TeamRunner } from "../../team/runner"
import { TeamInfo, TeamMemberInfo, TaskItemInfo, TeamMessageInfo } from "../../team/event"
import { Log } from "../../util/log"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

const log = Log.create({ service: "server" })

export const TeamRoutes = lazy(() =>
  new Hono()
    .post(
      "/",
      describeRoute({
        summary: "Create team",
        description: "Create a new agent team with a lead session.",
        operationId: "team.create",
        responses: {
          200: {
            description: "Team created",
            content: {
              "application/json": {
                schema: resolver(TeamInfo),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", TeamModule.CreateInput),
      async (c) => {
        const body = c.req.valid("json")
        const team = await TeamModule.create(body)
        return c.json(team)
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List teams",
        description: "Get a list of all teams for a project.",
        operationId: "team.list",
        responses: {
          200: {
            description: "List of teams",
            content: {
              "application/json": {
                schema: resolver(TeamInfo.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          projectID: z.string(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const teams = await TeamModule.list(query.projectID)
        return c.json(teams)
      },
    )
    .get(
      "/:teamID",
      describeRoute({
        summary: "Get team",
        description: "Get team info, members, and tasks.",
        operationId: "team.get",
        responses: {
          200: {
            description: "Team info with members and tasks",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: TeamInfo,
                    members: TeamMemberInfo.array(),
                    tasks: TaskItemInfo.array(),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const info = await TeamModule.get(teamID)
        if (!info) {
          return c.json({ error: "Team not found" }, 404)
        }
        const members = await TeamModule.members(teamID)
        const tasks = await TaskList.list(teamID)
        return c.json({ info, members, tasks })
      },
    )
    .delete(
      "/:teamID",
      describeRoute({
        summary: "Disband team",
        description: "Disband a team and clean up worktrees.",
        operationId: "team.disband",
        responses: {
          204: {
            description: "Team disbanded",
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      async (c) => {
        const { teamID } = c.req.valid("param")
        await TeamModule.disband(teamID)
        c.status(204)
      },
    )
    .post(
      "/:teamID/member",
      describeRoute({
        summary: "Add teammate",
        description: "Add a teammate to the team.",
        operationId: "team.addMember",
        responses: {
          200: {
            description: "Teammate added",
            content: {
              "application/json": {
                schema: resolver(TeamMemberInfo),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      validator("json", TeamModule.AddMemberInput.omit({ teamID: true })),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const body = c.req.valid("json")
        const member = await TeamModule.addMember({ teamID, ...body })
        return c.json(member)
      },
    )
    .delete(
      "/:teamID/member/:sessionID",
      describeRoute({
        summary: "Remove teammate",
        description: "Remove a teammate from the team.",
        operationId: "team.removeMember",
        responses: {
          204: {
            description: "Teammate removed",
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const { teamID, sessionID } = c.req.valid("param")
        await TeamModule.updateMemberStatus(teamID, sessionID, "done")
        c.status(204)
      },
    )
    .post(
      "/:teamID/task",
      describeRoute({
        summary: "Create tasks",
        description: "Create tasks for the team.",
        operationId: "team.createTasks",
        responses: {
          200: {
            description: "Tasks created",
            content: {
              "application/json": {
                schema: resolver(TaskItemInfo.array()),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      validator("json", TaskList.CreateInput.omit({ teamID: true })),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const body = c.req.valid("json")
        const tasks = await TaskList.create({ teamID, ...body })
        return c.json(tasks)
      },
    )
    .patch(
      "/:teamID/task/:taskID",
      describeRoute({
        summary: "Update task",
        description: "Claim or update a task.",
        operationId: "team.updateTask",
        responses: {
          200: {
            description: "Task updated",
            content: {
              "application/json": {
                schema: resolver(TaskItemInfo),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
          taskID: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          action: z.enum(["claim", "complete"]),
          sessionID: SessionID.zod.optional(),
        }),
      ),
      async (c) => {
        const { teamID, taskID } = c.req.valid("param")
        const body = c.req.valid("json")

        if (body.action === "claim" && body.sessionID) {
          const task = await TaskList.claim(teamID, body.sessionID, taskID)
          return c.json(task)
        } else if (body.action === "complete") {
          const task = await TaskList.complete(taskID)
          return c.json(task)
        }

        return c.json({ error: "Invalid action" }, 400)
      },
    )
    .get(
      "/:teamID/message",
      describeRoute({
        summary: "List team messages",
        description: "List all messages sent within a team.",
        operationId: "team.listMessages",
        responses: {
          200: {
            description: "Team messages",
            content: {
              "application/json": {
                schema: resolver(TeamMessageInfo.array()),
              },
            },
          },
        },
      }),
      validator("param", z.object({ teamID: z.string() })),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const msgs = await TeamMessage.listByTeam(teamID)
        return c.json(msgs)
      },
    )
    .post(
      "/:teamID/message",
      describeRoute({
        summary: "Send message",
        description: "Send a message to a team member or broadcast.",
        operationId: "team.sendMessage",
        responses: {
          200: {
            description: "Message sent",
            content: {
              "application/json": {
                schema: resolver(TeamMessageInfo),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      validator("json", TeamMessage.SendInput.omit({ teamID: true })),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const body = c.req.valid("json")
        const msg = await TeamMessage.send({ teamID, ...body })
        return c.json(msg)
      },
    )
    .post(
      "/:teamID/plan/:sessionID/approve",
      describeRoute({
        summary: "Approve plan",
        description: "Approve a teammate's plan.",
        operationId: "team.approvePlan",
        responses: {
          204: {
            description: "Plan approved",
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
          sessionID: SessionID.zod,
        }),
      ),
      async (c) => {
        const { teamID, sessionID } = c.req.valid("param")
        await PlanApproval.approve(teamID, sessionID)
        c.status(204)
      },
    )
    .post(
      "/:teamID/plan/:sessionID/reject",
      describeRoute({
        summary: "Reject plan",
        description: "Reject a teammate's plan with feedback.",
        operationId: "team.rejectPlan",
        responses: {
          204: {
            description: "Plan rejected",
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
          sessionID: SessionID.zod,
        }),
      ),
      validator(
        "json",
        z.object({
          feedback: z.string(),
        }),
      ),
      async (c) => {
        const { teamID, sessionID } = c.req.valid("param")
        const { feedback } = c.req.valid("json")
        await PlanApproval.reject(teamID, sessionID, feedback)
        c.status(204)
      },
    )
    .post(
      "/:teamID/start",
      describeRoute({
        summary: "Start team",
        description: "Start all teammates with their assigned tasks.",
        operationId: "team.start",
        responses: {
          204: {
            description: "Team started",
          },
        },
      }),
      validator(
        "param",
        z.object({
          teamID: z.string(),
        }),
      ),
      validator(
        "json",
        z.object({
          tasks: z.array(
            z.object({
              taskID: z.string(),
              sessionID: SessionID.zod,
            }),
          ),
          timeout: z.number().optional(),
        }),
      ),
      async (c) => {
        const { teamID } = c.req.valid("param")
        const { tasks, timeout } = c.req.valid("json")
        await TeamRunner.startAll({ teamID, tasks, timeout })
        c.status(204)
      },
    ),
)
