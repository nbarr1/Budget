import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { importStatement } from '@/import/pipeline';

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const files = form.getAll('statement').filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length === 0) {
    return NextResponse.redirect(new URL('/?upload=empty', request.url), 303);
  }

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importStatement(user.id, { fileName: file.name, mimeType: file.type, bytes });
    await prisma.importJob.create({
      data: {
        userId: user.id,
        sourceType: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV',
        status: 'COMPLETED',
        rawFileName: file.name,
        reportJson: JSON.stringify(result),
      },
    });
  }

  return NextResponse.redirect(new URL('/', request.url), 303);
}
