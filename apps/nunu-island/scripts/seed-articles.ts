import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { defaultArticles } from '../src/data/articles'

async function run() {
  const payload = await getPayload({ config: configPromise })

  for (const item of defaultArticles) {
    const existing = await payload.find({
      collection: 'articles',
      where: {
        or: [
          {
            legacyId: {
              equals: item.id,
            },
          },
          {
            slug: {
              equals: item.id,
            },
          },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const data = {
      legacyId: item.id,
      slug: item.id,
      title: item.title,
      subtitle: item.subtitle,
      coverImage: item.coverImage,
      tags: item.tags.map((tag) => ({ tag })),
      contentText: item.content.join('\n'),
    }

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'articles',
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
      console.log(`updated: ${item.id}`)
    } else {
      await payload.create({
        collection: 'articles',
        data,
        overrideAccess: true,
      })
      console.log(`created: ${item.id}`)
    }
  }

  console.log('seed articles completed')
}

void run().catch((error) => {
  console.error('seed articles failed', error)
  process.exit(1)
})
