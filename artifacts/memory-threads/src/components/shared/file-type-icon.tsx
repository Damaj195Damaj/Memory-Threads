import { FileText, Image as ImageIcon, Table, Code, File as FileIcon } from 'lucide-react';

interface FileTypeIconProps {
  type: string;
  className?: string;
}

export function FileTypeIcon({ type, className }: FileTypeIconProps) {
  const typeLower = type?.toLowerCase() || '';
  
  if (typeLower.includes('pdf') || typeLower.includes('doc') || typeLower.includes('txt') || typeLower.includes('text')) {
    return <FileText className={className} />;
  }
  if (typeLower.includes('image') || typeLower.includes('png') || typeLower.includes('jpg') || typeLower.includes('jpeg')) {
    return <ImageIcon className={className} />;
  }
  if (typeLower.includes('csv') || typeLower.includes('excel') || typeLower.includes('spreadsheet')) {
    return <Table className={className} />;
  }
  if (typeLower.includes('md') || typeLower.includes('markdown') || typeLower.includes('json')) {
    return <Code className={className} />;
  }
  
  return <FileIcon className={className} />;
}
