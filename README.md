# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Environment Variables

This application may require certain environment variables to be set for full functionality, especially for features involving Generative AI with Genkit.

Create a `.env` file in the root of your project (if it doesn't already exist) and add the necessary variables. For example:

```env
# For Genkit AI features using Google's Gemini models
GEMINI_API_KEY=your_gemini_api_key_here

# Other variables can be added here as needed
# EXAMPLE_VARIABLE=example_value
```

**Important**: After adding or modifying your `.env` file, you **must restart your development server** for the changes to take effect.

Refer to the documentation for specific services (like Genkit or Firebase) to find out which environment variables are required and how to obtain their values. For Genkit with Google AI, see: `https://firebase.google.com/docs/genkit/plugins/google-genai`
