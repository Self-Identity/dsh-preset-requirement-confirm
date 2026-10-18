/**
 * `ask_user_question` with a per-question `detail` explanation.
 *
 * The shipped `@deepseek-ai/dsh-tool-ask-user` schema exposes
 * id/question/header/options/multi_select (and, in `timed` mode, `timeout`), so a
 * model cannot attach a plain-language explanation to one question. The
 * user-questions seam already carries `AskUserQuestionItem.detail` (the
 * `plan-review` intent uses it for the plan body) and the Web question card
 * renders it with the assistant Markdown primitive, so this row registers the
 * SAME tool name — keeping the `ask_user_question` tool-row integration — with
 * one extra field.
 *
 * It imports no package on purpose: a bare `@deepseek-ai/dsh-*` import from a
 * third-party profile package can resolve to a second copy of the runtime
 * through `$DSH_HOME/profiles/node_modules`, so every interaction goes through
 * `ctx` and the definition is registered in the raw registry shape
 * (`output.render` plus a JSON Schema `parameters` object, which `register()`
 * accepts without `defineTool`).
 *
 * Mounted only as a row inside the `requirement-confirm` preset
 * (`cordis.patch.yml` -> `dsh-preset-requirement-confirm/tool`).
 */

export const name = 'tool-requirement-questionnaire'

/** @type {string[]} */
export const inject = ['tools', 'userQuestions']

const description = 'Ask the user a batch of questions about missing information, preferences, or decisions before proceeding. '
  + 'Send one or more questions, each with a stable id echoed in the answer; ids must be unique within one call. '
  + 'Put a plain-language explanation of what a question means and why you are asking it in that question\'s `detail` — the Web card renders it directly under the question. '
  + 'Offer the choices the user can pick from in `options`, including an "以上皆可" option where several answers would be acceptable. '
  + 'The user can always type a free-form answer instead of choosing an option.'

const parameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      description: 'Questions to ask the user before continuing.',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: {
            type: 'string',
            description: 'Stable id for this question, unique within the call; echoed in the answer.',
          },
          question: {
            type: 'string',
            description: 'The specific question to ask the user.',
          },
          header: {
            type: 'string',
            description: 'Optional short heading for the question, such as "Confirm" or "Choose Mode".',
          },
          detail: {
            type: 'string',
            description: 'Optional plain-language explanation of what this question means and why it is asked; '
              + 'the Web question card renders it directly under the question. Keep it out of the option labels.',
          },
          options: {
            type: 'array',
            description: 'Optional choices to show the user. If you recommend one, put it first and append "(Recommended)" to that label. '
              + 'Add an "以上皆可" choice when several answers would be equally acceptable.',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                label: { type: 'string', description: 'Short user-facing option label.' },
                description: { type: 'string', description: 'One sentence explaining the tradeoff or impact.' },
              },
              required: ['label'],
            },
          },
          multi_select: {
            type: 'boolean',
            description: 'Whether the user may select more than one option. Defaults to false.',
          },
        },
        required: ['id', 'question'],
      },
    },
  },
  required: ['questions'],
}

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          selected: { type: 'array', items: { type: 'string' } },
          custom: { type: 'string' },
        },
        required: ['id', 'selected'],
      },
    },
  },
  required: ['answers'],
}

/**
 * @param {unknown} value - canonical answer batch.
 * @returns {Array<{ type: 'text', text: string }>} model-facing content.
 */
function render(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value) }]
}

/**
 * Reject duplicate question ids before the request reaches the seam.
 * @param {Array<{ id: string }>} questions - model-supplied questions.
 */
function validateQuestionIds(questions) {
  const seen = new Set()
  for (const question of questions) {
    if (seen.has(question.id)) throw new Error(`question id ${JSON.stringify(question.id)} must be unique within this call`)
    seen.add(question.id)
  }
}

/**
 * Register the questionnaire tool on the calling agent's scope.
 * @param {import('@deepseek-ai/cordis').Context} ctx - agent-scoped context providing `tools` and `userQuestions`.
 */
export function apply(ctx) {
  ctx.tools.register({
    name: 'ask_user_question',
    description,
    parameters,
    output: { schema: outputSchema, render },
    async execute(args, exec) {
      const questions = Array.isArray(args?.questions) ? args.questions : []
      validateQuestionIds(questions)
      const result = await ctx.userQuestions.ask({
        questions: questions.map(question => ({
          id: question.id,
          question: question.question,
          ...question.header !== undefined ? { header: question.header } : {},
          ...question.detail !== undefined ? { detail: question.detail } : {},
          ...question.options !== undefined ? { options: question.options } : {},
          ...question.multi_select !== undefined ? { multiSelect: question.multi_select } : {},
        })),
        ...exec.agent !== undefined ? { agent: exec.agent } : {},
        signal: exec.signal,
      })
      return {
        answers: result.answers.map(answer => ({
          id: answer.id,
          selected: [...answer.selected],
          ...answer.custom !== undefined ? { custom: answer.custom } : {},
        })),
      }
    },
  })
}
