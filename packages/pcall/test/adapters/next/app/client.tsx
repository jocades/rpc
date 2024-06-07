'use client'

import { client } from '@/client'
import type { AppRouter } from '@/../test/mock'
import { useQuery } from '@tanstack/react-query'

const api = client<AppRouter>({ url: '/api' })

export function Client() {
  const { data } = useQuery({
    queryKey: ['client-test'],
    queryFn: async () => {
      return await Promise.all([
        api.ping(),
        api.users.getById({ userId: 'xx' }),
        api.posts.getById({ postId: 2 }),
      ])
    },
  })

  return <pre>{JSON.stringify(data, null, 2)}</pre>
}