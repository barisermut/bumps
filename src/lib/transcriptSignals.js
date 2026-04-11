function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

function extractBlock(rawText, tagName) {
  if (!rawText || typeof rawText !== "string") return null;
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = rawText.match(re);
  return match ? match[1] : null;
}

function extractSkillNames(rawText) {
  const block = extractBlock(rawText, "manually_attached_skills");
  if (!block) return [];
  const out = [];
  const re = /\/([^/\n]+)\/SKILL\.md\b/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    if (match[1]) out.push(match[1]);
  }
  return uniqueSorted(out);
}

function extractSubagentTypes(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const out = [];
  const re = /subagent_type\s*[:=]\s*["']?([a-zA-Z-]+)["']?/g;
  let match;
  while ((match = re.exec(rawText)) !== null) {
    if (match[1]) out.push(match[1]);
  }
  return uniqueSorted(out);
}

function extractTranscriptRefs(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const out = [];
  const re = /agent-transcripts\/([a-z0-9-]+)/gi;
  let match;
  while ((match = re.exec(rawText)) !== null) {
    if (match[1]) out.push(match[1]);
  }
  return uniqueSorted(out);
}

function stripTranscriptMarkup(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/<\/?user_query>/gi, "")
    .replace(/<attached_files>[\s\S]*?<\/attached_files>/gi, "")
    .replace(/<image_files>[\s\S]*?<\/image_files>/gi, "")
    .replace(/\[Image\]/g, "")
    .trim();
}

function collectTranscriptSignals(rawText) {
  const skillsReferenced = extractSkillNames(rawText);
  const subagentsReferenced = extractSubagentTypes(rawText);
  const agentTranscriptRefs = extractTranscriptRefs(rawText);
  const hasAttachedFiles = /<attached_files>/i.test(rawText);
  const hasImages =
    /<image_files>/i.test(rawText) || /\[Image\]/.test(rawText);
  const looksDelegated =
    /(^|\n)\s*#\s*Role\b/i.test(rawText) ||
    /(^|\n)\s*Role:\s*/i.test(rawText) ||
    /You are working on @/i.test(rawText) ||
    /Full audit details/i.test(rawText);

  const sessionContextSignals = [];
  if (skillsReferenced.length > 0) sessionContextSignals.push("manual-skills");
  if (subagentsReferenced.length > 0) {
    sessionContextSignals.push("subagent-context");
  }
  if (agentTranscriptRefs.length > 0) {
    sessionContextSignals.push("linked-transcript");
  }
  if (looksDelegated) sessionContextSignals.push("delegated-task");
  if (hasAttachedFiles) sessionContextSignals.push("file-context");
  if (hasImages) sessionContextSignals.push("image-context");

  return {
    cleanedText: stripTranscriptMarkup(rawText),
    skillsReferenced,
    subagentsReferenced,
    agentTranscriptRefs,
    sessionContextSignals,
    attachmentsSummary: {
      hasFiles: hasAttachedFiles,
      hasImages,
      imageCount: hasImages ? 1 : 0,
    },
  };
}

module.exports = {
  collectTranscriptSignals,
  stripTranscriptMarkup,
  extractSkillNames,
  extractSubagentTypes,
  extractTranscriptRefs,
};
