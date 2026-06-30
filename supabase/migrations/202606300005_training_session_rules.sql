do $$
begin
  if to_regclass('public.game_progression_settings') is not null then
    update public.game_progression_settings
    set
      default_attribute_level_cap = 10,
      daily_training_limit = 2,
      training_cooldown_minutes = 0,
      updated_at = now();
  end if;

  if to_regclass('public.training_attribute_configs') is not null then
    update public.training_attribute_configs
    set
      unit = 'minutes',
      starting_goal = 30,
      goal_increment = 0,
      attribute_xp_reward = 1,
      level_cap = 10,
      goal_template = case attribute_key
        when 'strength' then '30 minute strength session'
        when 'endurance' then '30 minute endurance session'
        when 'agility' then '30 minute agility session'
        when 'intelligence' then '30 minute study session'
        when 'wisdom' then '30 minute wisdom session'
        when 'charisma' then '30 minute charisma session'
        when 'spirit' then '30 minute spirit session'
        else '30 minute training session'
      end,
      activities = case attribute_key
        when 'strength' then '30 minutes of strength training, lifting heavy things, weighted exercise, bodyweight work, or physical labor.'
        when 'endurance' then '30 minutes of hiking, jogging, power walking, long walks, or steady physical work.'
        when 'agility' then '30 minutes of stretching, yoga, sprint intervals, balance drills, mobility work, or sport practice.'
        when 'intelligence' then '30 minutes of reading, studying, language learning, courses, writing notes, or focused research.'
        when 'wisdom' then '30 minutes of meditation, journaling, breathing practice, reflection, slow walks, or mindful rest.'
        when 'charisma' then '30 minutes of going out, socializing, calling someone, community activity, conversation practice, or encouraging others.'
        when 'spirit' then '30 minutes of prayer, faith study, religious study, gratitude practice, kindness, service, or personal reflection.'
        else activities
      end,
      updated_at = now();
  end if;
end $$;
