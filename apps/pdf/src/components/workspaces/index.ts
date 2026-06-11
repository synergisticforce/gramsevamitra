import type { ComponentType } from 'react';
import type { ToolId } from '../../config/toolsRegistry';
import CompressKbTool from './CompressKbTool';
import MergePdfTool from './MergePdfTool';
import SplitPdfTool from './SplitPdfTool';
import RotatePdfTool from './RotatePdfTool';
import ReorderPdfTool from './ReorderPdfTool';
import RemovePagesTool from './RemovePagesTool';
import JpgToPdfTool from './JpgToPdfTool';
import PdfToJpgTool from './PdfToJpgTool';
import PdfToTextTool from './PdfToTextTool';
import DeskewPdfTool from './DeskewPdfTool';
import WatermarkPdfTool from './WatermarkPdfTool';
import PageNumbersPdfTool from './PageNumbersPdfTool';
import OrganizePdfTool from './OrganizePdfTool';
import SignPdfTool from './SignPdfTool';
import CropPdfTool from './CropPdfTool';
import UnlockPdfTool from './UnlockPdfTool';
import ProtectPdfTool from './ProtectPdfTool';
import PdfScannerEffectTool from './PdfScannerEffectTool';
import {
  RepairPdfTool,
  RepairMetaTool,
  PngToPdfTool,
  WordToPdfTool,
  HeicToPdfTool,
  TextToPdfTool,
  PdfToPngTool,
  PdfToWordTool,
} from './AdditionalTools';

export const TOOL_COMPONENTS: Record<ToolId, ComponentType> = {
  'compress-kb': CompressKbTool,
  'repair-pdf': RepairPdfTool,
  'deskew-pdf': DeskewPdfTool,
  'repair-meta': RepairMetaTool,
  'merge-pdf': MergePdfTool,
  'split-pdf': SplitPdfTool,
  'remove-pages': RemovePagesTool,
  'rotate-pdf': RotatePdfTool,
  'reorder-pages': ReorderPdfTool,
  'add-page-numbers': PageNumbersPdfTool,
  'watermark-pdf': WatermarkPdfTool,
  'jpg-to-pdf': JpgToPdfTool,
  'png-to-pdf': PngToPdfTool,
  'word-to-pdf': WordToPdfTool,
  'heic-to-pdf': HeicToPdfTool,
  'text-to-pdf': TextToPdfTool,
  'pdf-to-jpg': PdfToJpgTool,
  'pdf-to-png': PdfToPngTool,
  'pdf-to-text': PdfToTextTool,
  'pdf-to-word': PdfToWordTool,
  'organize-pdf': OrganizePdfTool,
  'sign-pdf': SignPdfTool,
  'crop-pdf': CropPdfTool,
  'unlock-pdf': UnlockPdfTool,
  'protect-pdf': ProtectPdfTool,
  'pdf-scanner': PdfScannerEffectTool,
};
