---
name: research-to-vault
description: Use when conducting research that should be captured in the Obsidian vault - automatically stores findings as notes with proper organization and linking
---

# Research to Vault Workflow

## Overview

This skill combines research activities with automatic knowledge capture in an Obsidian vault. When you research a topic, findings are incrementally stored as properly organized, linked notes.

## When to Use

- User asks you to research a topic and save findings
- User wants to build up knowledge on a subject over time
- User needs documentation captured as notes
- Any research task where results should persist in the vault

## The Workflow

### Phase 1: Setup Research Note

Before starting research, create a central note for the topic:

```bash
# Check for existing research on this topic
petra note search "topic-name"
petra tag search "research"

# Create research note if none exists
petra note create "Research/topic-name" \
  --title "Research: Topic Name" \
  --tags "research,in-progress" \
  --content "## Overview

Research started: $(date +%Y-%m-%d)

## Key Questions
- Question 1
- Question 2

## Findings

## Sources

## Connections
"
```

### Phase 2: Incremental Capture

As you discover information, append to the research note:

```bash
# Add a finding
petra note update "Research/topic-name" --append "
### Finding: Subtopic

Summary of what was learned.

Source: [Source Name](url)
Related: [[Other Note]]
"
```

### Phase 3: Create Linked Notes

For substantial subtopics, create separate notes and link them:

```bash
# Create detailed subtopic note
petra note create "Research/topic-name/subtopic" \
  --title "Subtopic Detail" \
  --tags "research,topic-name" \
  --content "## Overview

Detail about this subtopic.

## Details

More information...

## See Also
- [[Research/topic-name]] - Main research note
"

# Update main note to link to subtopic
petra note update "Research/topic-name" --append "
- [[Research/topic-name/subtopic]] - Detailed notes on subtopic
"
```

### Phase 4: Wrap Up

When research is complete, update status:

```bash
# Mark as complete
petra note update "Research/topic-name" --append "
## Summary

Key takeaways from this research:
1. Takeaway 1
2. Takeaway 2

---
Research completed: $(date +%Y-%m-%d)
Status: Complete
"

# Could also update tags (manual edit needed for frontmatter)
```

## Sub-Agent Dispatch Pattern

For complex research tasks, dispatch the knowledge-manager agent:

```
Use Task tool with:
- subagent_type: "knowledge-manager"
- prompt: "Research [topic] and capture findings in the vault.
  Create a main research note at Research/[topic] and
  linked sub-notes for major subtopics. Tag with 'research'
  and relevant subject tags."
```

### Parallel Research Pattern

For multi-faceted research, dispatch multiple knowledge-manager agents:

```
Dispatch in parallel:
1. knowledge-manager: "Research aspect A of topic, save to Research/topic/aspect-a"
2. knowledge-manager: "Research aspect B of topic, save to Research/topic/aspect-b"
3. knowledge-manager: "Research aspect C of topic, save to Research/topic/aspect-c"

Then synthesize: Create Research/topic/synthesis linking all aspects
```

## Example Session

User: "Research Rust async patterns and save to my vault"

```bash
# 1. Check existing knowledge
petra note search "rust async"
petra tag search "rust"

# 2. Create main research note
petra note create "Programming/Rust/async-patterns" \
  --title "Rust Async Patterns" \
  --tags "rust,async,programming,research"

# 3. Research and capture (iteratively)
petra note update "Programming/Rust/async-patterns" --append "
## Async/Await Basics

Rust's async model is based on...

Key concepts:
- Future trait
- async fn syntax
- .await points
"

# 4. Create detailed sub-notes for complex topics
petra note create "Programming/Rust/async-patterns/tokio-runtime" \
  --title "Tokio Runtime Deep Dive" \
  --tags "rust,async,tokio"

# 5. Link everything together
petra note update "Programming/Rust/async-patterns" --append "
## Detailed Notes
- [[Programming/Rust/async-patterns/tokio-runtime]]
"
```

## Best Practices

1. **Hierarchical Paths**: Use `Category/Topic/Subtopic` structure
2. **Consistent Tags**: Include both specific (`rust`) and general (`programming`) tags
3. **Link Liberally**: Use `[[wikilinks]]` to connect related notes
4. **Incremental Updates**: Append findings as you go, don't wait until the end
5. **Source Attribution**: Always note where information came from
6. **Date Stamps**: Include when research was conducted

## Red Flags

- Creating flat structure without organization
- Not checking for existing notes on the topic
- Failing to link related concepts
- No source attribution
- Massive single notes instead of linked smaller notes
