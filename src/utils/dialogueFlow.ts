import type { NpcDefinition } from "../services/combatAdminService";
import type { AbilityDefinition } from "../services/abilityService";
import type { CharacterWithDetails } from "../services/characterService";
import type { InventoryItem, ItemDefinition } from "../services/inventoryService";
import type { MapEvent, StoryDialogueChoice, StoryDialogueNode } from "../services/mapService";

export type LegacyDialogueChoice = MapEvent["choices"][number];
export type DialogueChoiceAvailability = {
  met: boolean;
  hidden: boolean;
  disabled: boolean;
  message: string | null;
};
export type DialogueRequirementContext = {
  character: CharacterWithDetails;
  inventoryItems: InventoryItem[];
  itemDefinitions: ItemDefinition[];
  completedMarkerIds: Set<string>;
  completedEventIds: Set<string>;
  completedTutorialStepIds: Set<string>;
  storyFlags: Map<string, boolean>;
  knownAbilities: AbilityDefinition[];
};
export type DialogueAttributeCheckResult = {
  attribute: NonNullable<StoryDialogueChoice["check_attribute"]>;
  attributeValue: number;
  dc: number;
  roll: number;
  total: number;
  succeeded: boolean;
  resultLines: string[];
};

type DialogueSceneStateInput = {
  event: MapEvent;
  nodes: StoryDialogueNode[];
  choices: StoryDialogueChoice[];
  npcs: NpcDefinition[];
  activeNodeId: string | null;
};

export function getDialogueSceneState({ event, nodes, choices, npcs, activeNodeId }: DialogueSceneStateInput) {
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes.find((node) => node.is_start) ?? nodes[0] ?? null;
  const nodeChoices = activeNode ? choices.filter((choice) => choice.node_id === activeNode.id) : [];
  const legacyChoices = event.choices.length > 0 ? event.choices : [{ label: "Return to Map", action: "Continue" as const }];
  const nodeNpc = npcs.find((npc) => npc.id === activeNode?.npc_id);
  const eventNpc = npcs.find((npc) => npc.id === event.dialogue_npc_id);
  const npcName = nodeNpc?.name ?? activeNode?.npc_name ?? eventNpc?.name ?? event.npc_name;
  const npcPortrait = nodeNpc?.image_url ?? activeNode?.npc_portrait_url ?? eventNpc?.image_url ?? event.npc_portrait_url;
  const backgroundImageUrl = activeNode?.background_image_url ?? event.background_image_url;
  const dialogueText = activeNode?.dialogue_text || event.dialogue_text || "The trail grows quiet.";

  return {
    activeNode,
    nodeChoices,
    legacyChoices,
    npcName,
    npcPortrait,
    backgroundImageUrl,
    dialogueText,
  };
}

export function eventTypeName(type: MapEvent["event_type"]) {
  if (type === "battle") {
    return "Battle Event";
  }

  if (type === "clue") {
    return "Clue / Investigation Event";
  }

  if (type === "reward") {
    return "Reward Event";
  }

  return "Dialogue Event";
}

export function eventTriggerModeName(event: MapEvent) {
  if ((event.trigger_mode ?? "fixed") === "random") {
    return `Random ${Number(event.random_chance_percent ?? 0)}% after ${event.distance_marker_percent}%`;
  }

  return `Fixed at ${event.distance_marker_percent}%`;
}

export function choiceActionLabel(action: StoryDialogueChoice["action"]) {
  if (action === "go_to_node") {
    return "Go to another dialogue step";
  }

  if (action === "start_battle") {
    return "Start linked battle event";
  }

  if (action === "complete_event") {
    return "Complete this event";
  }

  if (action === "unlock_next_event") {
    return "Unlock next event";
  }

  if (action === "give_reward") {
    return "Give reward";
  }

  if (action === "end_conversation") {
    return "End conversation";
  }

  return "Return to map";
}

export function formatResourceName(resource: string) {
  if (resource === "magicka" || resource === "magika") {
    return "Mana";
  }
  if (resource === "health") {
    return "Health";
  }
  if (resource === "stamina") {
    return "Stamina";
  }
  return resource;
}

export function getChoiceTargetSummary(choice: StoryDialogueChoice, nodes: StoryDialogueNode[], events: MapEvent[]) {
  if (choice.action === "go_to_node") {
    const nextNode = nodes.find((node) => node.id === choice.next_node_id);
    return nextNode
      ? { label: `Then show dialogue step: ${nextNode.sort_order}. ${nextNode.title}`, isBroken: false }
      : { label: "Broken link: choose a target dialogue step", isBroken: true };
  }

  if (choice.action === "start_battle") {
    const battle = events.find((event) => event.id === choice.battle_event_id);
    return battle
      ? { label: `Then start battle: ${battle.title}`, isBroken: false }
      : { label: "Broken link: choose a target battle event", isBroken: true };
  }

  if (choice.action === "complete_event") {
    return { label: "Then complete this event", isBroken: false };
  }

  if (choice.action === "unlock_next_event") {
    return { label: "Then unlock the next trail event", isBroken: false };
  }

  if (choice.action === "give_reward") {
    return { label: `Then give reward: ${choice.reward_xp} XP${choice.reward_item ? ` and ${choice.reward_item}` : ""}`, isBroken: false };
  }

  if (choice.action === "end_conversation") {
    return { label: "Then end conversation", isBroken: false };
  }

  return { label: "Then return to map", isBroken: false };
}

export function evaluateDialogueChoiceRequirement(choice: StoryDialogueChoice, context: DialogueRequirementContext): DialogueChoiceAvailability {
  const type = choice.requirement_type ?? "none";
  if (type === "none") {
    return { met: true, hidden: false, disabled: false, message: null };
  }

  const result = getRequirementResult(choice, context);
  const message = result.met ? null : choice.requirement_failure_message?.trim() || result.defaultMessage;

  return {
    met: result.met,
    hidden: !result.met && Boolean(choice.hide_if_unmet),
    disabled: !result.met && Boolean(choice.disable_if_unmet),
    message,
  };
}

export function getRequirementSummary(choice: StoryDialogueChoice, itemDefinitions: ItemDefinition[]) {
  const type = choice.requirement_type ?? "none";
  if (type === "none") {
    return "No requirement";
  }

  const label = getRequirementValueLabel(choice, itemDefinitions);
  if (type === "gold") {
    return `Requires ${getRequirementAmount(choice)} Gold`;
  }
  if (type === "item") {
    return `Requires ${label} x${getRequirementAmount(choice)}`;
  }
  if (type === "attribute_level") {
    return `Requires ${label} ${choice.requirement_operator ?? ">="} ${getRequirementAmount(choice)}`;
  }
  return `Requires ${requirementTypeLabel(type)}: ${label}`;
}

export function hasDialogueAttributeCheck(choice: StoryDialogueChoice) {
  return Boolean(choice.check_enabled && choice.check_attribute);
}

export function getAttributeCheckSummary(choice: StoryDialogueChoice) {
  if (!hasDialogueAttributeCheck(choice)) {
    return null;
  }

  return `[${formatAttributeName(choice.check_attribute)} Check] DC ${Number(choice.check_dc ?? 10)}`;
}

export function rollDialogueAttributeCheck(choice: StoryDialogueChoice, character: CharacterWithDetails): DialogueAttributeCheckResult | null {
  if (!choice.check_enabled || !choice.check_attribute) {
    return null;
  }

  const attribute = choice.check_attribute;
  const attributeValue = Number(character.attributes?.[attribute] ?? 0);
  const dc = Math.max(1, Number(choice.check_dc) || 10);
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + attributeValue;
  const succeeded = total >= dc;
  const attributeName = formatAttributeName(attribute);

  return {
    attribute,
    attributeValue,
    dc,
    roll,
    total,
    succeeded,
    resultLines: [
      `Rolling ${attributeName}...`,
      `d20: ${roll}`,
      `${attributeName}: +${attributeValue}`,
      `Total: ${total} vs DC ${dc}`,
      succeeded ? (choice.check_success_text?.trim() || "Success!") : (choice.check_failure_text?.trim() || "Failure."),
    ],
  };
}

export function formatAttributeName(attribute: string | null | undefined) {
  if (!attribute) {
    return "Attribute";
  }
  return attribute.charAt(0).toUpperCase() + attribute.slice(1);
}

export function requirementTypeLabel(type: StoryDialogueChoice["requirement_type"]) {
  if (type === "gold") return "Gold";
  if (type === "item") return "Item";
  if (type === "story_flag") return "Story Flag";
  if (type === "completed_marker") return "Completed Marker";
  if (type === "completed_event") return "Completed Event";
  if (type === "tutorial_step") return "Tutorial Step";
  if (type === "ability_known") return "Ability Known";
  if (type === "attribute_level") return "Attribute Level";
  return "No Requirement";
}

function getRequirementResult(choice: StoryDialogueChoice, context: DialogueRequirementContext) {
  const value = choice.requirement_value?.trim() ?? "";
  const amount = getRequirementAmount(choice);

  if (choice.requirement_type === "gold") {
    return {
      met: compareNumber(Number(context.character.gold ?? 0), amount, choice.requirement_operator),
      defaultMessage: `Requires ${amount} Gold`,
    };
  }

  if (choice.requirement_type === "item") {
    const owned = context.inventoryItems
      .filter((item) => item.item_id === value || item.item.name.toLowerCase() === value.toLowerCase())
      .reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    return {
      met: owned >= amount,
      defaultMessage: `Requires ${getRequirementValueLabel(choice, context.itemDefinitions)}`,
    };
  }

  if (choice.requirement_type === "story_flag") {
    return {
      met: context.storyFlags.get(value) === true,
      defaultMessage: `Requires story flag: ${value}`,
    };
  }

  if (choice.requirement_type === "completed_marker") {
    return {
      met: context.completedMarkerIds.has(value),
      defaultMessage: "Requires a completed story marker",
    };
  }

  if (choice.requirement_type === "completed_event") {
    return {
      met: context.completedEventIds.has(value),
      defaultMessage: "Requires a completed event",
    };
  }

  if (choice.requirement_type === "tutorial_step") {
    return {
      met: context.completedTutorialStepIds.has(value),
      defaultMessage: "Requires tutorial completion",
    };
  }

  if (choice.requirement_type === "ability_known") {
    return {
      met: context.knownAbilities.some((ability) => ability.key === value || ability.adminAbility?.id === value || ability.name.toLowerCase() === value.toLowerCase()),
      defaultMessage: `Requires ability: ${value}`,
    };
  }

  if (choice.requirement_type === "attribute_level") {
    const attributeValue = Number(context.character.attributes?.[value as keyof NonNullable<CharacterWithDetails["attributes"]>] ?? 0);
    return {
      met: compareNumber(attributeValue, amount, choice.requirement_operator),
      defaultMessage: `Requires ${value} ${choice.requirement_operator ?? ">="} ${amount}`,
    };
  }

  return { met: true, defaultMessage: "" };
}

function getRequirementAmount(choice: StoryDialogueChoice) {
  const quantity = Number(choice.requirement_quantity ?? 0);
  const valueNumber = Number(choice.requirement_value ?? 0);
  return Math.max(1, quantity || valueNumber || 1);
}

function compareNumber(actual: number, expected: number, operator: StoryDialogueChoice["requirement_operator"] = ">=") {
  if (operator === ">") return actual > expected;
  if (operator === "=") return actual === expected;
  if (operator === "<=") return actual <= expected;
  if (operator === "<") return actual < expected;
  return actual >= expected;
}

function getRequirementValueLabel(choice: StoryDialogueChoice, itemDefinitions: ItemDefinition[]) {
  const value = choice.requirement_value?.trim() ?? "";
  if (choice.requirement_type === "item") {
    return itemDefinitions.find((item) => item.id === value)?.name ?? (value || "an item");
  }
  return value || "selected requirement";
}
