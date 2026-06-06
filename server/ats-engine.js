/**
 * ATS Engine — scores resumes the way company ATS systems do
 *
 * Real ATS (Workday, Greenhouse, Taleo) typically:
 * 1. Parse resume text
 * 2. Match keywords from job description (biggest factor)
 * 3. Check required skills & experience
 * 4. Verify education & contact info
 * 5. Score format (can the system read it?)
 * 6. Rank: Shortlist → Review → Reject
 */

// Skills companies commonly filter on
const TECH_SKILLS = [
  "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go", "rust",
  "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask",
  "spring", "html", "css", "tailwind", "bootstrap", "sql", "mysql", "postgresql",
  "mongodb", "redis", "aws", "azure", "gcp", "docker", "kubernetes", "jenkins",
  "git", "github", "gitlab", "ci/cd", "agile", "scrum", "jira", "rest", "api",
  "graphql", "microservices", "machine learning", "deep learning", "tensorflow",
  "pytorch", "pandas", "numpy", "data analysis", "excel", "power bi", "tableau",
  "figma", "photoshop", "seo", "marketing", "sales", "leadership", "communication",
  "project management", "problem solving", "linux", "bash", "terraform", "ansible",
];

const ACTION_VERBS = [
  "achieved", "automated", "built", "collaborated", "created", "delivered",
  "designed", "developed", "enhanced", "implemented", "improved", "increased",
  "led", "managed", "optimized", "produced", "reduced", "resolved", "streamlined",
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "will", "have", "your",
  "our", "are", "was", "been", "being", "their", "they", "you", "all", "can",
  "able", "work", "team", "role", "job", "position", "company", "years", "year",
  "experience", "required", "preferred", "must", "should", "including", "using",
]);

// Extract important words from job description
function extractJobKeywords(jobDescription) {
  if (!jobDescription) return [];

  const text = jobDescription.toLowerCase();
  const found = new Set();

  // Match known tech/business skills
  for (const skill of TECH_SKILLS) {
    if (text.includes(skill)) found.add(skill);
  }

  // Extract words from "required" / "must have" lines
  const lines = jobDescription.split(/[\n.]/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/required|must have|minimum|essential|mandatory/.test(lower)) {
      const words = lower
        .replace(/[^a-z0-9\s+#.]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      words.forEach((w) => found.add(w));
    }
  }

  // Add meaningful words from full description
  const allWords = text
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w));

  const wordCount = {};
  for (const w of allWords) {
    wordCount[w] = (wordCount[w] || 0) + 1;
  }

  // Top repeated words (likely important to the role)
  Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([w]) => found.add(w));

  return [...found].slice(0, 40);
}

// Extract skills mentioned in job description
function extractRequiredSkills(jobDescription) {
  if (!jobDescription) return [];

  const lower = jobDescription.toLowerCase();
  return TECH_SKILLS.filter((skill) => lower.includes(skill));
}

// Parse years of experience from job description
function extractRequiredExperience(jobDescription) {
  if (!jobDescription) return null;

  const match = jobDescription.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience)?/i);
  return match ? parseInt(match[1], 10) : null;
}

// Parse years of experience from resume
function extractResumeExperience(resumeText) {
  const patterns = [
    /(\d+)\+?\s*years?\s*(?:of)?\s*(?:experience)?/gi,
    /experience[:\s]+(\d+)\+?\s*years?/gi,
  ];

  let maxYears = 0;
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(resumeText)) !== null) {
      const years = parseInt(match[1], 10);
      if (years > maxYears) maxYears = years;
    }
  }

  // Estimate from date ranges like "2020 - 2024"
  const dateRanges = resumeText.match(/20\d{2}\s*[-–—]\s*(20\d{2}|present|current)/gi);
  if (dateRanges && maxYears === 0) {
    maxYears = Math.min(dateRanges.length * 2, 10);
  }

  return maxYears;
}

// Check education level
function checkEducation(resumeText, jobDescription) {
  const lower = resumeText.toLowerCase();
  const jobLower = (jobDescription || "").toLowerCase();

  const levels = {
    phd: /ph\.?d|doctorate/.test(lower),
    masters: /master|m\.?tech|m\.?sc|mba|m\.?e\.?/.test(lower),
    bachelors: /bachelor|b\.?tech|b\.?sc|b\.?e\.?|undergraduate|degree/.test(lower),
    diploma: /diploma|associate/.test(lower),
  };

  const jobNeedsDegree = /bachelor|master|degree|b\.?tech|mba|ph\.?d/.test(jobLower);
  const hasDegree = levels.bachelors || levels.masters || levels.phd || levels.diploma;

  return { levels, jobNeedsDegree, hasDegree };
}

// ATS format checks — can the system parse this resume?
function checkFormat(resumeText) {
  const issues = [];
  let score = 100;

  if (resumeText.length < 100) {
    issues.push("Very little text extracted — ATS may fail to parse");
    score -= 40;
  }

  if (/\|{3,}/.test(resumeText)) {
    issues.push("Complex table formatting detected — ATS may misread columns");
    score -= 15;
  }

  const wordCount = resumeText.split(/\s+/).length;
  if (wordCount > 900) {
    issues.push("Resume may be too long — most ATS prefer 1-2 pages");
    score -= 10;
  }

  if (!/[@][a-z0-9.-]+\.[a-z]{2,}/i.test(resumeText)) {
    issues.push("No email found — recruiters cannot contact you");
    score -= 20;
  }

  const standardSections = [
    /experience|employment|work history/i,
    /education|qualification/i,
    /skills|competencies/i,
  ];
  const sectionsFound = standardSections.filter((r) => r.test(resumeText)).length;
  if (sectionsFound < 2) {
    issues.push("Missing standard section headings (Experience, Education, Skills)");
    score -= 15;
  }

  return { score: Math.max(score, 0), issues };
}

// Main ATS scoring — mirrors company selection process
export function runATSCheck(resumeText, jobTitle, jobDescription) {
  const lower = resumeText.toLowerCase();

  // --- Step 1: Parse & format check ---
  const format = checkFormat(resumeText);

  // --- Step 2: Section detection (ATS field mapping) ---
  const sections = {
    contact: /[@][a-z0-9.-]+\.[a-z]{2,}|linkedin\.com/i.test(resumeText),
    phone: /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText),
    summary: /summary|objective|profile|about/i.test(lower),
    experience: /experience|employment|work history/i.test(lower),
    education: /education|degree|university|college/i.test(lower),
    skills: /skills|technologies|competencies|technical/i.test(lower),
    projects: /projects|portfolio/i.test(lower),
    certifications: /certification|certified|certificate/i.test(lower),
  };

  const sectionScore = Math.round(
    (Object.values(sections).filter(Boolean).length / Object.keys(sections).length) * 100
  );

  // --- Step 3: Keyword match (most important for ATS ranking) ---
  const jobKeywords = extractJobKeywords(jobDescription);
  const matchedKeywords = jobKeywords.filter((kw) => lower.includes(kw));
  const missingKeywords = jobKeywords.filter((kw) => !lower.includes(kw));

  const keywordMatchPercent =
    jobKeywords.length > 0
      ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
      : null;

  // --- Step 4: Skills match ---
  const requiredSkills = extractRequiredSkills(jobDescription);
  const resumeSkills = TECH_SKILLS.filter((s) => lower.includes(s));
  const matchedSkills = requiredSkills.filter((s) => lower.includes(s));
  const missingSkills = requiredSkills.filter((s) => !lower.includes(s));

  const skillsMatchPercent =
    requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : Math.min(Math.round((resumeSkills.length / 8) * 100), 100);

  // --- Step 5: Experience match ---
  const requiredYears = extractRequiredExperience(jobDescription);
  const resumeYears = extractResumeExperience(resumeText);

  let experienceScore = 70;
  let experienceDetail = "Experience section detected";

  if (requiredYears !== null) {
    if (resumeYears >= requiredYears) {
      experienceScore = 100;
      experienceDetail = `${resumeYears || "Sufficient"} years meets required ${requiredYears}+ years`;
    } else if (resumeYears > 0) {
      experienceScore = Math.round((resumeYears / requiredYears) * 100);
      experienceDetail = `Found ~${resumeYears} years — job requires ${requiredYears}+ years`;
    } else {
      experienceScore = 30;
      experienceDetail = `Could not verify ${requiredYears}+ years experience requirement`;
    }
  } else if (sections.experience) {
    experienceScore = 85;
    experienceDetail = "Work experience section present";
  } else {
    experienceScore = 40;
    experienceDetail = "No clear experience section — ATS may skip your resume";
  }

  // --- Step 6: Education match ---
  const education = checkEducation(resumeText, jobDescription);
  let educationScore = sections.education ? 90 : 40;
  let educationDetail = sections.education ? "Education section found" : "No education section detected";

  if (education.jobNeedsDegree && !education.hasDegree) {
    educationScore = 25;
    educationDetail = "Job requires a degree — not clearly found on resume";
  } else if (education.hasDegree) {
    educationScore = 100;
    educationDetail = "Degree qualification detected";
  }

  // --- Step 7: Content quality (recruiter secondary signals) ---
  const verbsFound = ACTION_VERBS.filter((v) => lower.includes(v));
  const hasMetrics = /\d+%|\d+\+|\$\d+|\d{1,3}(,\d{3})+/.test(resumeText);
  let contentScore = 50;
  if (verbsFound.length >= 5) contentScore += 25;
  else if (verbsFound.length >= 2) contentScore += 15;
  if (hasMetrics) contentScore += 25;
  if (sections.summary) contentScore += 10;
  contentScore = Math.min(contentScore, 100);

  // --- Step 8: Job title match ---
  let titleScore = null;
  if (jobTitle) {
    const titleWords = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const titleMatches = titleWords.filter((w) => lower.includes(w));
    titleScore = Math.round((titleMatches.length / titleWords.length) * 100);
  }

  // --- Weighted final score (how ATS ranks candidates) ---
  let atsScore;
  let breakdown;

  if (jobDescription && jobKeywords.length > 0) {
    // With job description — same weights companies use for role-specific screening
    breakdown = [
      { name: "Keyword Match", score: keywordMatchPercent, weight: 35, detail: `${matchedKeywords.length}/${jobKeywords.length} job keywords found` },
      { name: "Skills Match", score: skillsMatchPercent, weight: 25, detail: `${matchedSkills.length}/${requiredSkills.length || "N/A"} required skills` },
      { name: "Experience", score: experienceScore, weight: 15, detail: experienceDetail },
      { name: "Education", score: educationScore, weight: 10, detail: educationDetail },
      { name: "ATS Format", score: format.score, weight: 10, detail: format.issues[0] || "Resume is ATS-readable" },
      { name: "Content Quality", score: contentScore, weight: 5, detail: `${verbsFound.length} action verbs, ${hasMetrics ? "has" : "no"} metrics` },
    ];

    if (titleScore !== null) {
      // Adjust: keyword match slightly reduced, title match added
      breakdown[0].weight = 30;
      breakdown.push({ name: "Job Title Match", score: titleScore, weight: 5, detail: `Resume alignment with "${jobTitle}"` });
    }

    atsScore = Math.round(
      breakdown.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0)
    );
  } else {
    // Without job description — general ATS readiness scan
    breakdown = [
      { name: "Section Completeness", score: sectionScore, weight: 30, detail: `${Object.values(sections).filter(Boolean).length}/8 sections found` },
      { name: "ATS Format", score: format.score, weight: 25, detail: format.issues[0] || "Resume is ATS-readable" },
      { name: "Skills Listed", score: skillsMatchPercent, weight: 20, detail: `${resumeSkills.length} skills detected` },
      { name: "Experience", score: experienceScore, weight: 15, detail: experienceDetail },
      { name: "Content Quality", score: contentScore, weight: 10, detail: `${verbsFound.length} action verbs used` },
    ];

    atsScore = Math.round(
      breakdown.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0)
    );
  }

  atsScore = Math.min(Math.max(atsScore, 0), 100);

  // --- Verdict (how a company would treat this application) ---
  let verdict;
  let verdictDetail;

  if (atsScore >= 80) {
    verdict = "Shortlisted";
    verdictDetail = "Strong match — likely passes ATS and reaches a recruiter";
  } else if (atsScore >= 65) {
    verdict = "Under Review";
    verdictDetail = "Moderate match — may pass ATS depending on other applicants";
  } else if (atsScore >= 45) {
    verdict = "Low Match";
    verdictDetail = "Weak match — often filtered out by ATS before human review";
  } else {
    verdict = "Likely Rejected";
    verdictDetail = "Poor match — ATS systems typically auto-reject at this score";
  }

  // Knockout filters (instant reject rules many ATS use)
  const knockoutFails = [];
  if (!sections.contact) knockoutFails.push("No contact email — automatic reject in most ATS");
  if (keywordMatchPercent !== null && keywordMatchPercent < 30) {
    knockoutFails.push("Less than 30% keyword match — below most ATS thresholds");
  }
  if (requiredYears && resumeYears > 0 && resumeYears < requiredYears - 1) {
    knockoutFails.push(`Experience gap — requires ${requiredYears}+ years`);
  }
  if (education.jobNeedsDegree && !education.hasDegree) {
    knockoutFails.push("Degree requirement not met");
  }

  // Build strengths, weaknesses, recommendations
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (keywordMatchPercent !== null && keywordMatchPercent >= 70) {
    strengths.push(`${keywordMatchPercent}% keyword match with job description — strong ATS signal`);
  }
  if (matchedSkills.length >= 3) {
    strengths.push(`${matchedSkills.length} required skills matched: ${matchedSkills.slice(0, 4).join(", ")}`);
  }
  if (sections.experience && sections.skills) {
    strengths.push("Standard ATS sections (Experience, Skills) detected");
  }
  if (format.score >= 80) strengths.push("Resume format is ATS-friendly and parseable");
  if (verbsFound.length >= 4) strengths.push("Good use of action verbs recruiters search for");
  if (hasMetrics) strengths.push("Quantified achievements help ranking in ATS");

  if (keywordMatchPercent !== null && keywordMatchPercent < 50) {
    weaknesses.push(`Only ${keywordMatchPercent}% keyword match — ATS ranks by job description keywords`);
  }
  if (missingSkills.length > 0) {
    weaknesses.push(`Missing ${missingSkills.length} required skills: ${missingSkills.slice(0, 4).join(", ")}`);
  }
  if (format.issues.length > 0) weaknesses.push(format.issues[0]);
  if (!sections.summary) weaknesses.push("No professional summary — ATS may not identify your focus");
  if (!hasMetrics) weaknesses.push("No quantified results — add numbers to stand out in ranking");

  if (missingKeywords.length > 0) {
    recommendations.push(`Add these job keywords naturally: ${missingKeywords.slice(0, 5).join(", ")}`);
  }
  if (missingSkills.length > 0) {
    recommendations.push(`Include missing skills if you have them: ${missingSkills.slice(0, 4).join(", ")}`);
  }
  recommendations.push("Mirror exact phrases from the job description in your experience bullets");
  recommendations.push("Use standard headings: Experience, Education, Skills (ATS maps these fields)");
  recommendations.push("Start bullets with action verbs: Developed, Led, Implemented, Achieved");
  recommendations.push("Add metrics: percentages, team sizes, revenue, users impacted");

  if (!jobDescription) {
    recommendations.unshift("Paste the job description for accurate ATS keyword matching (most important factor)");
  }

  return {
    atsScore,
    verdict,
    verdictDetail,
    keywordMatchPercent,
    breakdown,
    knockoutFails,
    sections,
    matchedKeywords: matchedKeywords.slice(0, 15),
    missingKeywords: missingKeywords.slice(0, 10),
    matchedSkills: matchedSkills.slice(0, 10),
    missingSkills: missingSkills.slice(0, 10),
    suggestedKeywords: missingKeywords.slice(0, 8),
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    recommendations: recommendations.slice(0, 6),
    summary: `${verdict}: Score ${atsScore}/100. ${verdictDetail}`,
    mode: "ats",
  };
}
