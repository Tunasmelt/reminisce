import { NextResponse } from 'next/server'
import JSZip from 'jszip'

export async function POST(req: Request) {
  try {
    const { projectId, files } = await req.json()
    if (!projectId || !files) {
      return NextResponse.json({ error: 'Missing projectId or files' }, { status: 400 })
    }

    const zip = new JSZip()
    
    // Add each file to /reminisce/ root folder
    for (const [path, content] of Object.entries(files)) {
      zip.file(`reminisce/${path}`, content as string)
    }

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })
    
    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="reminisce-${projectId}.zip"`,
      }
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
