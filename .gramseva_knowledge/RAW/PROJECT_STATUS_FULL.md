# GramSeva Mitra — Project Status (Full)

**Generated:** 2026-06-18  
**Repository:** https://github.com/synergisticforce/gramsevamitra.git  
**Purpose:** Comprehensive status snapshot for AI assistant onboarding — directory layout, integrations, stack, git/deploy state, and security posture.

---

## 1. Complete Directory Tree

Excludes: `.git`, `node_modules`, `dist`, `.astro`, `.wrangler`, `.next`, `playwright/.cache`, `test-results`.

**~471 tracked source files** across monorepo (excluding build artifacts above).

```
GramsevaMitra/

    ├── .github/
    │   └── workflows/
    │       └── deploy.yml
    ├── apps/
    │   └── hub/
    │       ├── public/
    │       │   ├── data/
    │       │   │   ├── babyNames.json
    │       │   │   └── salaryBenchmarks.json
    │       │   ├── _headers
    │       │   ├── _redirects
    │       │   ├── favicon.svg
    │       │   ├── pwa-192.png
    │       │   ├── pwa-512.png
    │       │   └── robots.txt
    │       ├── src/
    │       │   ├── components/
    │       │   │   ├── app/
    │       │   │   │   ├── AppGlobalHeader.tsx
    │       │   │   │   ├── AppSessionHeader.tsx
    │       │   │   │   ├── AppShellFooter.tsx
    │       │   │   │   ├── AppSidebar.tsx
    │       │   │   │   ├── FeedbackWidget.tsx
    │       │   │   │   ├── OfflineNetworkGuard.tsx
    │       │   │   │   ├── WorkspaceAuthBoundary.tsx
    │       │   │   │   └── WorkspaceEmptyState.astro
    │       │   │   ├── billing/
    │       │   │   │   ├── AuthModal.tsx
    │       │   │   │   ├── ProFeatureTrigger.astro
    │       │   │   │   └── ProPricingModal.tsx
    │       │   │   ├── canvas/
    │       │   │   │   ├── AtsScannerModal.tsx
    │       │   │   │   ├── BusinessCardModal.tsx
    │       │   │   │   ├── CanvasProcessingOverlay.tsx
    │       │   │   │   ├── CanvasToast.tsx
    │       │   │   │   ├── CareerActionToolbar.tsx
    │       │   │   │   ├── CareerAiResultModal.tsx
    │       │   │   │   ├── CareerMagicDropzone.tsx
    │       │   │   │   ├── CareerPrepCanvas.tsx
    │       │   │   │   ├── ColdEmailModal.tsx
    │       │   │   │   ├── CompressPdfModal.tsx
    │       │   │   │   ├── ConvertFormatModal.tsx
    │       │   │   │   ├── CoverLetterModal.tsx
    │       │   │   │   ├── CropPdfModal.tsx
    │       │   │   │   ├── DeskewPdfModal.tsx
    │       │   │   │   ├── DocumentActionToolbar.tsx
    │       │   │   │   ├── DocumentStudioCanvas.tsx
    │       │   │   │   ├── ExamPhotoOptimizerModal.tsx
    │       │   │   │   ├── ExtractToWordModal.tsx
    │       │   │   │   ├── FinanceCryptoGainsCalculator.tsx
    │       │   │   │   ├── FinanceCurrencyConverter.tsx
    │       │   │   │   ├── FinanceDiscountMarginCalculator.tsx
    │       │   │   │   ├── FinanceEmiCalculator.tsx
    │       │   │   │   ├── FinanceEnvelopeBudgetPlanner.tsx
    │       │   │   │   ├── FinanceGigIncomeTracker.tsx
    │       │   │   │   ├── FinanceGstCalculator.tsx
    │       │   │   │   ├── FinanceHubCanvas.tsx
    │       │   │   │   ├── FinanceInvoiceBuilder.tsx
    │       │   │   │   ├── FinanceLoanRepaymentCalculator.tsx
    │       │   │   │   ├── FinanceMeetingCostCalculator.tsx
    │       │   │   │   ├── FinancePayStubGenerator.tsx
    │       │   │   │   ├── FinanceSalaryBenchmark.tsx
    │       │   │   │   ├── FinanceSalaryCalculator.tsx
    │       │   │   │   ├── FinanceSipCalculator.tsx
    │       │   │   │   ├── FinanceTaxDeductionCalculator.tsx
    │       │   │   │   ├── FinanceTipSplitCalculator.tsx
    │       │   │   │   ├── FinanceToolGrid.tsx
    │       │   │   │   ├── HiFiConverterModal.tsx
    │       │   │   │   ├── ImageCropperModal.tsx
    │       │   │   │   ├── ImageFilterModal.tsx
    │       │   │   │   ├── ImageToPdfModal.tsx
    │       │   │   │   ├── ImageWatermarkModal.tsx
    │       │   │   │   ├── JobTrackerModal.tsx
    │       │   │   │   ├── LegalTemplatesModal.tsx
    │       │   │   │   ├── LifestyleAgeDateCalculator.tsx
    │       │   │   │   ├── LifestyleBmiCalculator.tsx
    │       │   │   │   ├── LifestyleBodyFatCalculator.tsx
    │       │   │   │   ├── LifestyleExamAgeCalculator.tsx
    │       │   │   │   ├── LifestyleHubCanvas.tsx
    │       │   │   │   ├── LifestyleMacroCalculator.tsx
    │       │   │   │   ├── LifestyleMenstrualCalculator.tsx
    │       │   │   │   ├── LifestyleMoodLog.tsx
    │       │   │   │   ├── LifestyleToolGrid.tsx
    │       │   │   │   ├── MagicDropzone.tsx
    │       │   │   │   ├── MediaActionToolbar.tsx
    │       │   │   │   ├── MediaLabCanvas.tsx
    │       │   │   │   ├── MediaMagicDropzone.tsx
    │       │   │   │   ├── MergePdfModal.tsx
    │       │   │   │   ├── OrganisePdfModal.tsx
    │       │   │   │   ├── PageNumbersPdfModal.tsx
    │       │   │   │   ├── PdfToImageModal.tsx
    │       │   │   │   ├── PdfToTextModal.tsx
    │       │   │   │   ├── PhotoScannedPdfModal.tsx
    │       │   │   │   ├── ProcessingSpinner.tsx
    │       │   │   │   ├── ProtectPdfModal.tsx
    │       │   │   │   ├── QuickBabyNameGenerator.tsx
    │       │   │   │   ├── QuickBase64Tool.tsx
    │       │   │   │   ├── QuickColdEmailBuilder.tsx
    │       │   │   │   ├── QuickColorPalette.tsx
    │       │   │   │   ├── QuickConstructionEstimator.tsx
    │       │   │   │   ├── QuickDecisionWheel.tsx
    │       │   │   │   ├── QuickEventCountdown.tsx
    │       │   │   │   ├── QuickFormatConverter.tsx
    │       │   │   │   ├── QuickGardenPlantingPlanner.tsx
    │       │   │   │   ├── QuickHashGenerator.tsx
    │       │   │   │   ├── QuickJobTracker.tsx
    │       │   │   │   ├── QuickPasswordGenerator.tsx
    │       │   │   │   ├── QuickPercentageCalculator.tsx
    │       │   │   │   ├── QuickPetCareScheduler.tsx
    │       │   │   │   ├── QuickPomodoroTimer.tsx
    │       │   │   │   ├── QuickQrGenerator.tsx
    │       │   │   │   ├── QuickRandomNumberGenerator.tsx
    │       │   │   │   ├── QuickRecipeScaler.tsx
    │       │   │   │   ├── QuickRenovationBudgeter.tsx
    │       │   │   │   ├── QuickScientificCalculator.tsx
    │       │   │   │   ├── QuickSeoMetaGenerator.tsx
    │       │   │   │   ├── QuickToolsHubCanvas.tsx
    │       │   │   │   ├── QuickToolsToolGrid.tsx
    │       │   │   │   ├── QuickTypingSpeedTest.tsx
    │       │   │   │   ├── QuickUnitConverter.tsx
    │       │   │   │   ├── QuickUrlEncoder.tsx
    │       │   │   │   ├── RedactPdfModal.tsx
    │       │   │   │   ├── RemovePagesPdfModal.tsx
    │       │   │   │   ├── ReorderPdfModal.tsx
    │       │   │   │   ├── RepairPdfModal.tsx
    │       │   │   │   ├── ResizeCompressModal.tsx
    │       │   │   │   ├── RotatePdfModal.tsx
    │       │   │   │   ├── SalaryBenchmarkModal.tsx
    │       │   │   │   ├── SalaryCalculatorModal.tsx
    │       │   │   │   ├── SignPdfModal.tsx
    │       │   │   │   ├── SkillGapModal.tsx
    │       │   │   │   ├── SplitPdfModal.tsx
    │       │   │   │   ├── StripMetadataPdfModal.tsx
    │       │   │   │   ├── ToEditableFormatPanel.tsx
    │       │   │   │   ├── ToolProcessingWait.tsx
    │       │   │   │   ├── TypeSavePdfModal.tsx
    │       │   │   │   ├── UnlockPdfModal.tsx
    │       │   │   │   ├── VideoDropzone.tsx
    │       │   │   │   ├── VideoHubCanvas.tsx
    │       │   │   │   ├── VideoToolGrid.tsx
    │       │   │   │   ├── VideoToolPanel.tsx
    │       │   │   │   └── WatermarkPdfModal.tsx
    │       │   │   ├── legal/
    │       │   │   │   ├── LegalDocumentShell.tsx
    │       │   │   │   ├── PrivacyPolicy.tsx
    │       │   │   │   ├── RefundPolicy.tsx
    │       │   │   │   └── TermsOfService.tsx
    │       │   │   ├── omni/
    │       │   │   │   ├── OmniDropzone.tsx
    │       │   │   │   └── OmniHandoffLoading.tsx
    │       │   │   ├── pro/
    │       │   │   │   ├── ProCreditConfirmModal.tsx
    │       │   │   │   ├── ProTaskLoader.tsx
    │       │   │   │   └── SmartDocumentExtractorTool.tsx
    │       │   │   ├── saas/
    │       │   │   │   ├── SaaSLegalPage.astro
    │       │   │   │   ├── saasNav.ts
    │       │   │   │   └── SaaSNotFoundContent.astro
    │       │   │   └── tools/
    │       │   │       ├── AgeCalculatorTool.tsx
    │       │   │       ├── BabyNameFinderTool.tsx
    │       │   │       ├── Base64Tool.tsx
    │       │   │       ├── CaseConverterTool.tsx
    │       │   │       ├── ColorPaletteTool.tsx
    │       │   │       ├── CoverLetterGenerator.tsx
    │       │   │       ├── DecisionWheelTool.tsx
    │       │   │       ├── DocumentRedactor.tsx
    │       │   │       ├── DraftSavedBadge.astro
    │       │   │       ├── EmiCalculatorTool.tsx
    │       │   │       ├── ExamPhotoStudio.tsx
    │       │   │       ├── FlashcardGeneratorTool.tsx
    │       │   │       ├── FormatConverterTool.tsx
    │       │   │       ├── GstCalculatorTool.tsx
    │       │   │       ├── HashGeneratorTool.tsx
    │       │   │       ├── JobTrackerTool.tsx
    │       │   │       ├── MacroCalculatorTool.tsx
    │       │   │       ├── MarginCalculatorTool.tsx
    │       │   │       ├── MultiCurrencyConverterTool.tsx
    │       │   │       ├── OcrExtractor.tsx
    │       │   │       ├── PasswordGeneratorTool.tsx
    │       │   │       ├── PercentageCalculatorTool.tsx
    │       │   │       ├── PwaRegister.tsx
    │       │   │       ├── QrGeneratorTool.tsx
    │       │   │       ├── RecipeScalerTool.tsx
    │       │   │       ├── SalaryBenchmarker.tsx
    │       │   │       ├── ScientificCalculatorTool.tsx
    │       │   │       ├── SeoMetaGeneratorTool.tsx
    │       │   │       ├── SipCalculatorTool.tsx
    │       │   │       ├── TypingSpeedTestTool.tsx
    │       │   │       ├── TypingTestTool.tsx
    │       │   │       ├── UnitConverterTool.tsx
    │       │   │       └── WordCounterTool.tsx
    │       │   ├── config/
    │       │   │   ├── appWorkspaces.ts
    │       │   │   ├── careerCanvasActions.ts
    │       │   │   ├── documentCanvasActions.ts
    │       │   │   ├── financeCanvasTools.ts
    │       │   │   ├── indexableRoutes.ts
    │       │   │   ├── lifestyleCanvasTools.ts
    │       │   │   ├── mediaCanvasActions.ts
    │       │   │   ├── quickToolsCanvasTools.ts
    │       │   │   ├── toolsRegistry.ts
    │       │   │   └── videoCanvasTools.ts
    │       │   ├── data/
    │       │   │   └── babyNamesSeed.json
    │       │   ├── integrations/
    │       │   ├── layouts/
    │       │   │   └── AppShellLayout.astro
    │       │   ├── lib/
    │       │   │   ├── app/
    │       │   │   │   └── shellEvents.ts
    │       │   │   ├── auth/
    │       │   │   │   ├── creditCheck.ts
    │       │   │   │   ├── prepareAuthRedirect.ts
    │       │   │   │   ├── returnTo.ts
    │       │   │   │   ├── signOutSession.ts
    │       │   │   │   ├── signOutState.ts
    │       │   │   │   ├── triggers.ts
    │       │   │   │   ├── useProCreditConfirm.tsx
    │       │   │   │   ├── useSafeSession.ts
    │       │   │   │   ├── workspaceFileRegistry.ts
    │       │   │   │   └── workspaceResumeCache.ts
    │       │   │   ├── billing/
    │       │   │   │   └── useRazorpay.ts
    │       │   │   ├── canvas/
    │       │   │   │   ├── careerAtsMatch.ts
    │       │   │   │   ├── careerBusinessCard.ts
    │       │   │   │   ├── careerCanvasStorage.ts
    │       │   │   │   ├── careerColdEmail.ts
    │       │   │   │   ├── careerCoverLetter.ts
    │       │   │   │   ├── careerJobTrackerStorage.ts
    │       │   │   │   ├── careerLegalTemplates.ts
    │       │   │   │   ├── careerPdfText.ts
    │       │   │   │   ├── careerProAi.ts
    │       │   │   │   ├── careerSalaryBenchmark.ts
    │       │   │   │   ├── careerSalaryCalc.ts
    │       │   │   │   ├── careerSkillGap.ts
    │       │   │   │   ├── documentCanvasStorage.ts
    │       │   │   │   ├── documentFileConverter.ts
    │       │   │   │   ├── documentPdfTools.ts
    │       │   │   │   ├── documentSmartExtract.ts
    │       │   │   │   ├── extractToWord.ts
    │       │   │   │   ├── financeCanvasStorage.ts
    │       │   │   │   ├── lifestyleCanvasStorage.ts
    │       │   │   │   ├── mediaCanvasStorage.ts
    │       │   │   │   ├── mediaExamPhoto.ts
    │       │   │   │   ├── mediaImageTools.ts
    │       │   │   │   ├── mediaProProcess.ts
    │       │   │   │   ├── quickToolsCanvasStorage.ts
    │       │   │   │   ├── smartExtractPrep.ts
    │       │   │   │   ├── useCareerActionHandler.ts
    │       │   │   │   ├── useDocumentActionHandler.ts
    │       │   │   │   ├── useMediaActionHandler.ts
    │       │   │   │   ├── useModalMetaLoading.ts
    │       │   │   │   └── videoCanvasStorage.ts
    │       │   │   ├── charts/
    │       │   │   │   └── chartHelper.ts
    │       │   │   ├── convert/
    │       │   │   │   ├── recipeEngine.ts
    │       │   │   │   └── unitEngine.ts
    │       │   │   ├── crypto/
    │       │   │   │   ├── hashEngine.ts
    │       │   │   │   └── passwordEngine.ts
    │       │   │   ├── date/
    │       │   │   │   └── ageEngine.ts
    │       │   │   ├── design/
    │       │   │   │   └── colorEngine.ts
    │       │   │   ├── dev/
    │       │   │   │   └── formatEngine.ts
    │       │   │   ├── export/
    │       │   │   │   └── toolExport.ts
    │       │   │   ├── finance/
    │       │   │   │   ├── cryptoGainsEngine.ts
    │       │   │   │   ├── currencyDisplay.ts
    │       │   │   │   ├── currencyFxEngine.ts
    │       │   │   │   ├── discountEngine.ts
    │       │   │   │   ├── envelopeBudgetEngine.ts
    │       │   │   │   ├── formatInr.ts
    │       │   │   │   ├── gigIncomeEngine.ts
    │       │   │   │   ├── gstEngine.ts
    │       │   │   │   ├── invoiceDocument.ts
    │       │   │   │   ├── loanEngine.ts
    │       │   │   │   ├── marginEngine.ts
    │       │   │   │   ├── meetingCostEngine.ts
    │       │   │   │   ├── payStubDocument.ts
    │       │   │   │   ├── sipEngine.ts
    │       │   │   │   ├── taxDeductionEngine.ts
    │       │   │   │   └── tipSplitEngine.ts
    │       │   │   ├── fun/
    │       │   │   │   └── wheelPhysics.ts
    │       │   │   ├── lifestyle/
    │       │   │   │   ├── bmiEngine.ts
    │       │   │   │   ├── bodyFatEngine.ts
    │       │   │   │   ├── dateEngine.ts
    │       │   │   │   ├── lifestyleUi.ts
    │       │   │   │   └── tdeeEngine.ts
    │       │   │   ├── network/
    │       │   │   │   └── offlineNetworkGuard.ts
    │       │   │   ├── ocr/
    │       │   │   │   ├── ocrWaterfallPipeline.ts
    │       │   │   │   ├── ocrWorkerTypes.ts
    │       │   │   │   ├── tesseractTier1.ts
    │       │   │   │   └── tesseractWorkerTypes.ts
    │       │   │   ├── omni/
    │       │   │   │   ├── blindDrop.ts
    │       │   │   │   ├── handoff.ts
    │       │   │   │   ├── intentEngine.ts
    │       │   │   │   ├── omniDispatch.ts
    │       │   │   │   └── useOmniWorkspaceHandoff.ts
    │       │   │   ├── pdf/
    │       │   │   │   ├── cropCoords.ts
    │       │   │   │   ├── deviceDetection.ts
    │       │   │   │   ├── downloadPdf.ts
    │       │   │   │   ├── fileUploadLimits.ts
    │       │   │   │   ├── pageRangeParser.ts
    │       │   │   │   ├── passwordStrength.ts
    │       │   │   │   ├── pdfByteSanitizer.ts
    │       │   │   │   ├── pdfEncryption.ts
    │       │   │   │   ├── pdfJsWorker.ts
    │       │   │   │   ├── pdfMemory.ts
    │       │   │   │   ├── pdfOverlay.ts
    │       │   │   │   ├── pdfRender.ts
    │       │   │   │   ├── pdfStreamTransfer.ts
    │       │   │   │   ├── pdfWorkerClient.ts
    │       │   │   │   ├── redactionTypes.ts
    │       │   │   │   └── scannerEffect.ts
    │       │   │   ├── quick/
    │       │   │   │   ├── formatConverter.ts
    │       │   │   │   └── quickToolEngines.ts
    │       │   │   ├── quickTools/
    │       │   │   │   ├── lineItemBudgetEngine.ts
    │       │   │   │   ├── scientificCalcEngine.ts
    │       │   │   │   └── textCodecEngine.ts
    │       │   │   ├── seo/
    │       │   │   │   └── seoMetaEngine.ts
    │       │   │   ├── services/
    │       │   │   │   ├── layoutAnalyzer.ts
    │       │   │   │   ├── tesseractWrapper.ts
    │       │   │   │   └── toEditableFormatPipeline.ts
    │       │   │   ├── storage/
    │       │   │   │   ├── draftSaved.ts
    │       │   │   │   └── safeStorage.ts
    │       │   │   ├── upload/
    │       │   │   │   └── chunkedPipeline.ts
    │       │   │   └── video/
    │       │   │       ├── ffmpegClient.ts
    │       │   │       ├── videoFrameExtract.ts
    │       │   │       ├── videoMemoryLimits.ts
    │       │   │       └── videoProcess.ts
    │       │   ├── pages/
    │       │   │   ├── billing/
    │       │   │   │   ├── cancel.astro
    │       │   │   │   └── success.astro
    │       │   │   ├── workspace/
    │       │   │   │   ├── legal/
    │       │   │   │   │   ├── index.astro
    │       │   │   │   │   ├── privacy.astro
    │       │   │   │   │   ├── refund.astro
    │       │   │   │   │   └── terms.astro
    │       │   │   │   ├── career.astro
    │       │   │   │   ├── documents.astro
    │       │   │   │   ├── finance.astro
    │       │   │   │   ├── image.astro
    │       │   │   │   ├── lifestyle.astro
    │       │   │   │   ├── media.astro
    │       │   │   │   ├── quick-tools.astro
    │       │   │   │   └── video.astro
    │       │   │   ├── 404.astro
    │       │   │   ├── contact.astro
    │       │   │   ├── disclaimer.astro
    │       │   │   ├── index.astro
    │       │   │   ├── offline.astro
    │       │   │   ├── privacy.astro
    │       │   │   └── terms.astro
    │       │   ├── workers/
    │       │   │   ├── ocr.worker.ts
    │       │   │   ├── pdfCanvas.worker.ts
    │       │   │   └── tesseractOcr.worker.ts
    │       │   └── env.d.ts
    │       ├── .env
    │       ├── astro.config.mjs
    │       ├── package.json
    │       ├── tsconfig.json
    │       └── wrangler.toml
    ├── cloudflare/
    │   └── DEPLOYMENT.md
    ├── functions/
    │   ├── _lib/
    │   │   ├── auth.mjs
    │   │   ├── authBindingDiagnostics.mjs
    │   │   ├── authSession.mjs
    │   │   ├── billingEnv.mjs
    │   │   ├── careerAiMock.mjs
    │   │   ├── chunkedDocumentProcessing.mjs
    │   │   ├── chunkedPipeline.mjs
    │   │   ├── creditEconomy.mjs
    │   │   ├── json.mjs
    │   │   ├── neonDb.mjs
    │   │   ├── ocrEngines.mjs
    │   │   ├── ocrOrchestrator.mjs
    │   │   ├── pdfOverlayHelpers.mjs
    │   │   ├── proBilling.mjs
    │   │   ├── proGate.mjs
    │   │   ├── proTransientStorage.mjs
    │   │   ├── razorpay.mjs
    │   │   ├── razorpayWebhook.mjs
    │   │   ├── reconstructLayout.mjs
    │   │   ├── runtimeEnv.mjs
    │   │   ├── sesMail.mjs
    │   │   ├── session.mjs
    │   │   ├── smartExtractHandler.mjs
    │   │   ├── smartRouter.mjs
    │   │   └── userDb.mjs
    │   ├── api/
    │   │   ├── admin/
    │   │   │   └── ses-test.js
    │   │   ├── auth/
    │   │   │   └── [[path]].js
    │   │   ├── billing/
    │   │   │   ├── payment-status.js
    │   │   │   ├── razorpay-order.js
    │   │   │   ├── razorpay-webhook.js
    │   │   │   └── verify-payment.js
    │   │   ├── chunked/
    │   │   │   ├── document/
    │   │   │   │   ├── merge.js
    │   │   │   │   ├── process.js
    │   │   │   │   └── split.js
    │   │   │   ├── finalize.js
    │   │   │   └── session.js
    │   │   ├── pro/
    │   │   │   ├── file-converter/
    │   │   │   │   └── upload.js
    │   │   │   ├── media-process/
    │   │   │   │   └── upload.js
    │   │   │   ├── reconstruct-layout/
    │   │   │   │   └── upload.js
    │   │   │   ├── smart-extract/
    │   │   │   │   └── upload.js
    │   │   │   ├── career-ai.js
    │   │   │   ├── extract.js
    │   │   │   ├── file-converter.js
    │   │   │   ├── media-process.js
    │   │   │   ├── ocr-orchestrator.js
    │   │   │   ├── reconstruct-layout.js
    │   │   │   ├── smart-extract.js
    │   │   │   └── smart-router.js
    │   │   ├── user/
    │   │   │   └── credits.js
    │   │   ├── webhooks/
    │   │   │   └── razorpay.js
    │   │   └── contact.js
    │   └── .DS_Store
    ├── packages/
    │   ├── auth/
    │   │   ├── src/
    │   │   │   ├── auth.cli.ts
    │   │   │   ├── auth.ts
    │   │   │   ├── client.ts
    │   │   │   ├── index.ts
    │   │   │   └── sessionConfig.ts
    │   │   └── package.json
    │   └── shared/
    │       ├── public/
    │       │   ├── _headers
    │       │   ├── favicon.svg
    │       │   └── robots.txt
    │       ├── src/
    │       │   ├── components/
    │       │   │   ├── legal/
    │       │   │   │   ├── DisclaimerContent.astro
    │       │   │   │   ├── PrivacyPolicyContent.astro
    │       │   │   │   └── TermsOfServiceContent.astro
    │       │   │   ├── saas/
    │       │   │   │   ├── omniSearch.ts
    │       │   │   │   ├── OmniSearchPalette.tsx
    │       │   │   │   ├── SaaSMobilePill.astro
    │       │   │   │   ├── saasNav.ts
    │       │   │   │   └── SegmentedControl.astro
    │       │   │   ├── InstallAppBanner.tsx
    │       │   │   ├── LegalPage.astro
    │       │   │   ├── NotFoundContent.astro
    │       │   │   └── PostHogAnalytics.astro
    │       │   ├── config/
    │       │   │   ├── pwa.mjs
    │       │   │   ├── seo.ts
    │       │   │   └── sites.ts
    │       │   ├── layouts/
    │       │   │   └── BaseLayout.astro
    │       │   ├── lib/
    │       │   │   ├── aiCredits.mjs
    │       │   │   ├── proBilling.mjs
    │       │   │   ├── proTaskStages.ts
    │       │   │   ├── proUpgrade.ts
    │       │   │   └── pwaInstall.ts
    │       │   ├── styles/
    │       │   │   └── global.css
    │       │   ├── utils/
    │       │   │   ├── atsAnalyzer.ts
    │       │   │   ├── atsKeywordMatch.ts
    │       │   │   ├── documentProcessor.ts
    │       │   │   ├── fileUtils.ts
    │       │   │   ├── ocrPreprocess.ts
    │       │   │   ├── ocrQuality.ts
    │       │   │   └── payment.ts
    │       │   └── env.d.ts
    │       ├── package.json
    │       └── tailwind.config.mjs
    ├── scripts/
    │   ├── cf-auth.mjs
    │   ├── clean-baby-names.mjs
    │   ├── configure-routing.mjs
    │   ├── deploy-all.mjs
    │   ├── deploy-production.mjs
    │   ├── fix-utilities-hrefs.mjs
    │   ├── force-deploy.js
    │   ├── generate-audit.js
    │   ├── generate-pwa-icons.mjs
    │   ├── ingest-names.mjs
    │   ├── prod-sanity-check.js
    │   ├── production-release.mjs
    │   ├── scaffold-tools-routes.mjs
    │   ├── sync-public.mjs
    │   ├── toggle-env.js
    │   └── validate-tools-registry.mjs
    ├── tests/
    │   ├── fixtures/
    │   │   ├── output/
    │   │   │   └── dummy-15mb-photo.jpg
    │   │   └── generate-large-image.mjs
    │   ├── report/
    │   │   └── index.html
    │   ├── specs/
    │   └── playwright.config.mjs
    ├── .cursorrules
    ├── .DS_Store
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── .nvmrc
    ├── Audit_Report.docx
    ├── CURSOR_BIBLE.md
    ├── CURSOR_PRD.md
    ├── DISTRIBUTION.md
    ├── GRAMSEVA_MASTER_BLUEPRINT.md
    ├── GRAMSEVAMITRA_FULL_AUDIT.md
    ├── LAUNCH_CHECKLIST.md
    ├── MASTER_ARCHITECTURE.md
    ├── MASTER_DEV_PLAN.md
    ├── MASTER_PLAN.md
    ├── MASTER_REFACTOR_BIBLE.md
    ├── package-lock.json
    ├── package.json
    ├── robots.txt
    ├── schema.postgres.sql
    ├── schema.sql
    └── wrangler.toml
```

### Top-level summary

| Path | Purpose |
|------|---------|
| `apps/hub/` | Main Astro + React application (7 workspace canvases, PWA) |
| `functions/` | Cloudflare Pages Functions (API routes, Pro pipelines, auth) |
| `packages/auth/` | Better Auth configuration + client |
| `packages/shared/` | Shared UI, utils, styles, Pro billing helpers |
| `scripts/` | Deploy, env toggle, PWA icons, validation, audit tooling |
| `tests/` | Playwright E2E config + fixtures |
| `cloudflare/` | Deployment documentation |
| `schema.sql` / `schema.postgres.sql` | D1 (SQLite) and Neon (PostgreSQL) auth schemas |

---

## 2. Third-Party Integrations Analysis

### 2.1 AWS

| Service | Used? | Implementation |
|---------|-------|----------------|
| **Amazon SES** | **Yes** | `functions/_lib/sesMail.mjs` — sends auth OTP emails via SES HTTPS API (`SendEmail` action). Uses `aws4fetch` (`AwsClient`) for SigV4 signing on Workers edge. **Not S3.** |
| **Amazon S3** | **No** | Object storage uses **Cloudflare R2** instead (`PRO_TRANSIENT` binding in `wrangler.toml`). |

**Configuration (Cloudflare Pages secrets / `.env.example`):**
- `SES_REGION` (e.g. `eu-north-1`)
- `SES_ACCESS_KEY_ID`
- `SES_SECRET_ACCESS_KEY`
- `SES_FROM_EMAIL` (default: `support@gramsevamitra.com`)
- `SES_TEST_SECRET` (optional, for `POST /api/admin/ses-test`)

**Code paths:**
- `functions/_lib/auth.mjs` — calls `sendSesAuthEmail()` for Better Auth email OTP
- `functions/api/admin/ses-test.js` — admin diagnostic endpoint
- `apps/hub/src/components/billing/AuthModal.tsx` — surfaces SES sandbox errors to users

**Dependency:** `aws4fetch` in root `package.json` (lightweight AWS SigV4 fetch client for Workers).

---

### 2.2 Razorpay

| Aspect | Detail |
|--------|--------|
| **Status** | **Fully integrated** — Pro subscription checkout + webhook fulfillment |
| **Server SDK** | `razorpay` npm package (root `package.json`) + direct REST via `fetch` in `functions/_lib/razorpay.mjs` |
| **Client** | `apps/hub/src/lib/billing/useRazorpay.ts` + `ProPricingModal.tsx` |

**Environment variables:**
| Variable | Scope | Purpose |
|----------|-------|---------|
| `RAZORPAY_KEY_ID` | Server secret | Order creation, signature verify |
| `RAZORPAY_KEY_SECRET` | Server secret | HMAC checkout + webhook verification |
| `RAZORPAY_WEBHOOK_SECRET` | Server secret | Webhook HMAC-SHA256 |
| `PUBLIC_RAZORPAY_KEY_ID` | Build-time public | Razorpay Checkout modal (client-safe) |

**API routes:**
- `POST /api/billing/razorpay-order` — creates ₹99/year Pro order (`createProOrder`)
- `POST /api/billing/verify-payment` — verifies checkout signature client-side callback
- `POST /api/webhooks/razorpay` — **canonical** webhook handler
- `POST /api/billing/razorpay-webhook` — legacy alias redirecting to shared handler
- `GET /api/billing/payment-status` — poll activation after checkout

**Security features:** Web Crypto HMAC verification (`verifyRazorpayWebhookSignature`, `verifyRazorpayCheckoutSignature`), amount mismatch guards, order fetch validation.

**Ops scripts:** `scripts/toggle-env.js` (TEST vs LIVE keys), `scripts/production-release.mjs`, `scripts/force-deploy.js` (pushes secrets to Pages).

---

### 2.3 Cloudflare Pages / Workers

| Component | Configuration |
|-----------|---------------|
| **Hosting** | Cloudflare Pages — project `gramsevamitra-hub` |
| **Functions** | `functions/` directory → edge API routes |
| **Build output** | `apps/hub/dist` (`pages_build_output_dir` in root `wrangler.toml`) |
| **Node compat** | `compatibility_flags = ["nodejs_compat"]` |
| **D1 binding** | `DB` → `gramsevamitra-auth` (SQLite, local dev fallback) |
| **R2 binding** | `PRO_TRANSIENT` → `gramsevamitra-pro-transient` (ephemeral Pro uploads) |
| **Public var** | `BETTER_AUTH_URL = "https://gramsevamitra.com"` |

**Additional Cloudflare services used:**
- **Turnstile** — contact form bot protection (`functions/api/contact.js`, `TURNSTILE_SECRET_KEY`)
- **CDN** — static assets, FFmpeg WASM core loaded from jsDelivr (not CF CDN)

**Deploy paths:**
- **CI:** `.github/workflows/deploy.yml` → `wrangler pages deploy`
- **Manual:** `npm run deploy:production`, `npm run deploy:all`, `scripts/force-deploy.js`
- **DNS/routing:** `scripts/configure-routing.mjs` (requires `CLOUDFLARE_API_TOKEN`)

**Docs:** `cloudflare/DEPLOYMENT.md`

---

### 2.4 Database connections

| Database | Used? | Role |
|----------|-------|------|
| **Neon PostgreSQL** | **Yes (production preferred)** | Primary auth + billing user store via `DATABASE_URL` |
| **Cloudflare D1** | **Yes (fallback / local dev)** | SQLite binding `DB` in `wrangler.toml` |
| **Supabase** | **No** | Not referenced in codebase |
| **Firebase** | **No** | Not referenced in codebase |

**Implementation:**
- `@neondatabase/serverless` — HTTP driver (`functions/_lib/neonDb.mjs`, `packages/auth/src/auth.ts`)
- `functions/_lib/runtimeEnv.mjs` — **prefers Neon** (`DATABASE_URL`) over D1 when both present
- `functions/_lib/userDb.mjs` — user/credits/plan queries abstracted over Neon or D1
- `schema.postgres.sql` — Neon migration (Better Auth tables + billing fields)
- `schema.sql` — D1 migration

**Auth ORM:** Better Auth (`better-auth` ^1.2.9) with Google OAuth + email OTP plugin.

**Required production bindings** (`functions/_lib/auth.mjs`): `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`.

---

### 2.5 Other integrations (not in original list)

| Service | Usage |
|---------|-------|
| **Google OAuth** | Better Auth social provider (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) |
| **Resend** | Contact form email delivery (`functions/api/contact.js`, `RESEND_API_KEY`) — alternative to SES for contact only |
| **PostHog** | Product analytics (`packages/shared/src/components/PostHogAnalytics.astro`) — client-side project key |
| **Frankfurter API** | Live FX rates for Currency Converter (`currencyFxEngine.ts`) — 12 h local cache |
| **jsDelivr CDN** | FFmpeg WASM core loading (`ffmpegClient.ts`) |
| **Instamojo** | Legacy placeholder in `.env.example` (`PUBLIC_INSTAMOJO_PAYMENT_LINK`) — disabled |

---

## 3. Tech Stack & Core Dependencies

### 3.1 Architecture

- **Monorepo:** npm workspaces (`apps/*`, `packages/*`)
- **Node.js:** >= 18.17 (CI uses **20** via `.nvmrc`)
- **Module system:** ESM (`"type": "module"`)

### 3.2 Root `package.json`

| Category | Packages |
|----------|----------|
| **Auth** | `better-auth` ^1.2.9 |
| **Payments** | `razorpay` ^2.9.6 |
| **PDF** | `@cantoo/pdf-lib`, `pdfjs-dist` |
| **Database** | `@neondatabase/serverless` ^1.1.0 |
| **AWS edge** | `aws4fetch` ^1.0.20 |
| **DevOps** | `wrangler` ^3.114.0, `@playwright/test`, `sharp`, `docx` |

### 3.3 `apps/hub/package.json` (main app)

| Category | Packages |
|----------|----------|
| **Framework** | `astro` ^4.16, `@astrojs/react`, `@astrojs/tailwind`, `@astrojs/sitemap` |
| **UI** | `react` ^18.3, `tailwindcss` ^3.4 |
| **Documents** | `@cantoo/pdf-lib`, `pdfjs-dist`, `docx`, `tesseract.js` ^7 |
| **Media** | `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `browser-image-compression` |
| **Data/NLP** | `chart.js`, `compromise`, `qrcode`, `sortablejs` |
| **AI (client)** | `@huggingface/transformers` ^3.8 (TrOCR worker — legacy) |
| **PWA** | `@vite-pwa/astro`, `vite-plugin-pwa`, `workbox-window` |
| **Workspace packages** | `@gramsevamitra/auth`, `@gramsevamitra/shared` |

### 3.4 `packages/auth`

- `better-auth`, `@neondatabase/serverless`

### 3.5 `packages/shared`

- No runtime npm dependencies declared (peer/consumed by hub)
- Exports: components, layouts, utils, styles, Pro billing helpers

### 3.6 Key npm scripts

| Script | Action |
|--------|--------|
| `npm run dev:hub` | Astro dev server (:4321) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run validate:tools` | Workspace route validation |
| `npm run test:e2e` | Playwright tests |
| `npm run deploy:production` | Production deploy pipeline |
| `npm run db:migrate:remote` | D1 schema apply |

---

## 4. Git & Deployment Status

### 4.1 Current git status (as of report generation)

```
Branch: main
Tracking: origin/main (up to date)
Latest commit: 78a7856 — Feat: Secure Razorpay payment infrastructure with signature verification and webhook integration

Untracked files:
  - Audit_Report.docx
  - GRAMSEVAMITRA_FULL_AUDIT.md

Working tree: clean (no staged or modified tracked files)
```

### 4.2 GitHub Actions

**Single workflow:** `.github/workflows/deploy.yml` — **"Build & Deploy"**

| Trigger | Branches |
|---------|----------|
| `push` | `main`, `production` |
| `pull_request` | `main`, `production` |

**Job 1 — `build-and-verify` (all triggers):**
1. Checkout + Node 20 (`.nvmrc`)
2. Cache Astro/Vite artifacts
3. `npm ci`
4. Sync public assets + PWA icons
5. `npm run typecheck`
6. `npm run validate:tools`
7. `npm run build`
8. `npm run prod-check`
9. `npm run deploy:dry-run`
10. Upload `apps/hub/dist` artifact (7-day retention)

**Job 2 — `deploy-hub` (push to main/production only):**
1. Download hub artifact
2. Deploy via `cloudflare/wrangler-action@v3`:
   - `pages deploy apps/hub/dist --project-name=gramsevamitra-hub --branch=main`
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Environment: `production`

### 4.3 Cloudflare configuration files

| File | Role |
|------|------|
| `wrangler.toml` (root) | **Primary** — Pages project, D1, R2, vars, build output dir |
| `apps/hub/wrangler.toml` | Minimal local/preview assets config (`[assets] directory = "./dist"`) |
| `apps/hub/public/_headers` | Security/cache headers |
| `apps/hub/public/_redirects` | Legacy `/tools/*` → `/workspace/documents` |

---

## 5. Security Check

### 5.1 `.gitignore` status

**Present:** `.gitignore` at repository root.

**Ignored patterns (relevant):**
```
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.wrangler/
*.log
test-results/
playwright/.cache/
```

**Verification:**
- `.env` and `apps/hub/.env` exist on disk but are **correctly gitignored** (`git check-ignore` confirms)
- `.env` files are **not tracked** in git (`git ls-files` returns empty)
- `.env.example` is tracked (safe — placeholder values only)

### 5.2 Hardcoded secrets scan

Scanned tracked source for common secret patterns (`sk_live_`, `sk_test_` (long), `AKIA...`, `whsec_`, `re_` Resend keys):

| Finding | Severity | Notes |
|---------|----------|-------|
| **No server API secrets in tracked files** | ✅ Pass | Razorpay secrets, SES keys, DB URLs, auth secrets all loaded from env/bindings |
| `PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx` in `.env.example` | ✅ OK | Placeholder only |
| PostHog `phc_...` key in `PostHogAnalytics.astro` | ⚠️ Info | **Public client-side analytics key** — intended to be browser-visible; not a server secret |
| `wrangler.toml` D1 `database_id` | ⚠️ Info | Cloudflare resource identifier (not a credential); public in repo |
| Mock base64 DOCX/PPTX in `proTransientStorage.mjs` | ✅ OK | Test fixtures, not credentials |
| Docs reference `rzp_live_` / `rzp_test_` patterns | ✅ OK | Documentation and CLI prompts only |

**Secret management pattern:** Production secrets are set as **Cloudflare Pages secrets** via dashboard or `scripts/force-deploy.js` / `scripts/production-release.mjs` — never committed.

### 5.3 Security-related application features

- Razorpay webhook HMAC verification (Web Crypto)
- Checkout payment signature verification before Pro activation
- Turnstile on contact form
- Pro upload object-key path validation (`assertProObjectKeyForUser`)
- Transient R2 objects deleted after Pro processing (`context.waitUntil`)
- Better Auth session cookies with configured expiry (`sessionConfig.ts`)
- `BETTER_AUTH_SECRET` required in production auth bootstrap

### 5.4 Recommendations for AI assistant / maintainer

1. Do **not** commit `.env` — already gitignored; keep using `.env.example` as template.
2. Rotate Razorpay/SES keys via Cloudflare Pages secrets, not source code.
3. Consider moving PostHog project key to `PUBLIC_POSTHOG_KEY` env var (optional hygiene).
4. `Audit_Report.docx` and audit markdown files are untracked — add to git or `.gitignore` per team preference.

---

## Quick reference — environment variables

See `.env.example` for the authoritative list. Production secrets are Cloudflare Pages bindings.

| Variable | Service |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Better Auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `SES_*` | Amazon SES |
| `RAZORPAY_*` | Razorpay |
| `PUBLIC_RAZORPAY_KEY_ID` | Razorpay Checkout (public) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile |
| `RESEND_API_KEY` | Resend (contact form) |
| `CLOUDFLARE_API_TOKEN` | CI deploy + routing scripts |

---

*End of project status report.*
