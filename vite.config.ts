import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function tournamentAgentPreview(): Plugin {
  return {
    name: 'tournament-agent-preview',
    async configureServer(server) {
      const { default: handler } = await import('./api/tournament-agent')

      server.middlewares.use('/api/tournament-agent', async (req, res) => {
        const headers = new Headers()
        Object.entries(req.headers).forEach(([key, value]) => {
          if (typeof value === 'string') headers.set(key, value)
        })

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks)
        const request = new Request('http://localhost/api/tournament-agent', {
          method: req.method,
          headers,
          body: body.length > 0 ? body : undefined,
        })
        const response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY

  return {
    plugins: [react(), tournamentAgentPreview()],
  }
})
