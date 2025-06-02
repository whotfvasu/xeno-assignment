// backend/services/aiService.js
const axios = require("axios");

class AIService {
  constructor() {
    // Initialize with available AI providers
    this.providers = {
      openai: {
        available: !!process.env.OPENAI_API_KEY,
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: "https://api.openai.com/v1",
      },
      gemini: {
        available: !!process.env.GOOGLE_AI_API_KEY,
        apiKey: process.env.GOOGLE_AI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
      },
      huggingface: {
        available: !!process.env.HUGGINGFACE_API_KEY,
        apiKey: process.env.HUGGINGFACE_API_KEY,
        baseURL: "https://api-inference.huggingface.co",
      },
    };

    // Select primary provider
    this.primaryProvider = this.selectProvider();
  }

  selectProvider() {
    if (this.providers.openai.available) return "openai";
    if (this.providers.gemini.available) return "gemini";
    if (this.providers.huggingface.available) return "huggingface";
    return null;
  }

  async generateText(prompt, options = {}) {
    if (!this.primaryProvider) {
      throw new Error("No AI provider available. Please configure API keys.");
    }

    try {
      switch (this.primaryProvider) {
        case "openai":
          return await this.callOpenAI(prompt, options);
        case "gemini":
          return await this.callGemini(prompt, options);
        case "huggingface":
          return await this.callHuggingFace(prompt, options);
        default:
          throw new Error("No valid AI provider configured");
      }
    } catch (error) {
      console.error(
        `AI Service Error (${this.primaryProvider}):`,
        error.message
      );
      throw new Error("AI service temporarily unavailable");
    }
  }

  async callOpenAI(prompt, options = {}) {
    const response = await axios.post(
      `${this.providers.openai.baseURL}/chat/completions`,
      {
        model: options.model || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              options.systemPrompt ||
              "You are a helpful assistant for a CRM platform.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${this.providers.openai.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  async callGemini(prompt, options = {}) {
    const response = await axios.post(
      `${this.providers.gemini.baseURL}/models/gemini-pro:generateContent?key=${this.providers.gemini.apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `${
                  options.systemPrompt ||
                  "You are a helpful assistant for a CRM platform."
                }\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 500,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.candidates[0].content.parts[0].text.trim();
  }

  async callHuggingFace(prompt, options = {}) {
    const response = await axios.post(
      `${this.providers.huggingface.baseURL}/models/microsoft/DialoGPT-medium`,
      {
        inputs: prompt,
        parameters: {
          max_length: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.providers.huggingface.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data[0].generated_text.trim();
  }

  // Natural Language to Segment Rules
  async parseNaturalLanguageToRules(naturalLanguage) {
    const prompt = `
Convert the following natural language description into structured segment rules for a CRM system.

Description: "${naturalLanguage}"

Available fields and their types:
- totalSpent (number): Customer's total spending amount
- visitCount (number): Number of visits/orders
- daysSinceLastVisit (number): Days since last activity
- customerTier (string): BRONZE, SILVER, GOLD, PREMIUM
- location.city (string): Customer's city

Available operators: >, <, >=, <=, =, !=, in, not_in
Logical operators: AND, OR

Respond with ONLY a JSON array of rules in this exact format:
[
  {
    "field": "totalSpent",
    "operator": ">",
    "value": 10000,
    "logicalOperator": "AND"
  }
]

Examples:
"People who spent more than 10000" → [{"field": "totalSpent", "operator": ">", "value": 10000, "logicalOperator": "AND"}]
"Premium customers who haven't visited in 30 days" → [{"field": "customerTier", "operator": "=", "value": "PREMIUM", "logicalOperator": "AND"}, {"field": "daysSinceLastVisit", "operator": ">", "value": 30, "logicalOperator": "AND"}]
`;

    try {
      const response = await this.generateText(prompt, {
        systemPrompt: "You are a precise rule parser. Return only valid JSON.",
        temperature: 0.3,
      });

      // Extract JSON from response
      const jsonMatch = response.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const rules = JSON.parse(jsonMatch[0]);

      // Validate rules structure
      if (!Array.isArray(rules) || rules.length === 0) {
        throw new Error("Invalid rules format");
      }

      return rules;
    } catch (error) {
      console.error("Natural language parsing error:", error);
      throw new Error(
        "Failed to parse natural language. Please use more specific terms."
      );
    }
  }

  // AI-Driven Message Suggestions
  async generateCampaignMessages(
    campaignObjective,
    audienceDescription,
    count = 3
  ) {
    const prompt = `
Generate ${count} different marketing message variants for a campaign.

Campaign Objective: ${campaignObjective}
Target Audience: ${audienceDescription}

Requirements:
- Messages should be personalized (use {name} placeholder)
- Include a clear call-to-action
- Keep messages under 160 characters for SMS compatibility
- Make them engaging and relevant
- Include discount/offer if appropriate

Respond with ONLY a JSON array of message strings:
["Message 1", "Message 2", "Message 3"]
`;

    try {
      const response = await this.generateText(prompt, {
        systemPrompt:
          "You are a marketing copywriter specializing in personalized campaigns.",
        temperature: 0.8,
      });

      const jsonMatch = response.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const messages = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Invalid messages format");
      }

      return messages;
    } catch (error) {
      console.error("Message generation error:", error);
      throw new Error("Failed to generate campaign messages");
    }
  }

  // Campaign Performance Summarization
  async generateCampaignSummary(campaignData) {
    const {
      name,
      audienceSize,
      stats: { sent, failed, delivered, opened, clicked },
    } = campaignData;

    const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0;
    const openRate =
      delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : 0;
    const clickRate =
      delivered > 0 ? ((clicked / delivered) * 100).toFixed(1) : 0;

    const prompt = `
Analyze this campaign performance and provide a human-readable summary with insights:

Campaign: ${name}
Audience Size: ${audienceSize}
Messages Sent: ${sent}
Messages Failed: ${failed}
Messages Delivered: ${delivered}
Messages Opened: ${opened}
Messages Clicked: ${clicked}
Delivery Rate: ${deliveryRate}%
Open Rate: ${openRate}%
Click Rate: ${clickRate}%

Provide:
1. A brief performance summary
2. Key insights or concerns
3. Recommendations for improvement

Keep the response concise and actionable.
`;

    try {
      const summary = await this.generateText(prompt, {
        systemPrompt:
          "You are a marketing analytics expert providing campaign insights.",
        temperature: 0.5,
      });

      return summary;
    } catch (error) {
      console.error("Campaign summary error:", error);
      return "Campaign summary temporarily unavailable.";
    }
  }

  // Smart Scheduling Suggestions
  async suggestOptimalSendTime(audienceData) {
    const prompt = `
Based on the following audience characteristics, suggest the optimal day and time to send a marketing campaign:

Audience Data:
- Size: ${audienceData.size}
- Primary Location: ${audienceData.location || "India"}
- Customer Tier: ${audienceData.tier || "Mixed"}
- Industry/Category: ${audienceData.category || "E-commerce"}

Consider:
- Time zones
- Typical customer behavior patterns
- Industry best practices
- Day of week preferences

Respond with a specific recommendation including:
- Best day of the week
- Optimal time (in IST)
- Brief reasoning

Format: "Day: [day], Time: [time], Reason: [reasoning]"
`;

    try {
      const suggestion = await this.generateText(prompt, {
        systemPrompt: "You are a marketing timing optimization expert.",
        temperature: 0.6,
      });

      return suggestion;
    } catch (error) {
      console.error("Scheduling suggestion error:", error);
      return "Scheduling suggestions temporarily unavailable.";
    }
  }

  // Auto-tagging Campaigns
  async generateCampaignTags(campaignData) {
    const { message, audienceDescription } = campaignData;

    const prompt = `
Analyze this campaign and suggest 2-3 relevant tags for categorization:

Campaign Message: "${message}"
Target Audience: "${audienceDescription}"

Suggest tags from these categories or create new ones:
- Customer Lifecycle: New Customer, Win-back, Retention, Loyalty
- Value Segment: High Value, Budget Conscious, Premium
- Behavior: Frequent Buyer, Inactive, Seasonal
- Campaign Type: Promotional, Informational, Seasonal, Urgent

Respond with ONLY a JSON array of tag strings:
["tag1", "tag2", "tag3"]
`;

    try {
      const response = await this.generateText(prompt, {
        systemPrompt: "You are a campaign categorization expert.",
        temperature: 0.4,
      });

      const jsonMatch = response.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const tags = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(tags)) {
        throw new Error("Invalid tags format");
      }

      return tags;
    } catch (error) {
      console.error("Tag generation error:", error);
      return ["General"];
    }
  }
}

module.exports = new AIService();
