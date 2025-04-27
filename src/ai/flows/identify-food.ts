'use server';
/**
 * @fileOverview Identifies food items in an image.
 *
 * - identifyFoodItems - A function that handles the food identification process.
 * - IdentifyFoodItemsInput - The input type for the identifyFoodItems function.
 * - IdentifyFoodItemsOutput - The return type for the identifyFoodItems function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const IdentifyFoodItemsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of food, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyFoodItemsInput = z.infer<typeof IdentifyFoodItemsInputSchema>;

const IdentifyFoodItemsOutputSchema = z.object({
  foodItems: z.array(z.string()).describe('An array of identified food items in the image.'),
});
export type IdentifyFoodItemsOutput = z.infer<typeof IdentifyFoodItemsOutputSchema>;

export async function identifyFoodItems(input: IdentifyFoodItemsInput): Promise<IdentifyFoodItemsOutput> {
  return identifyFoodItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyFoodItemsPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo of food, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      foodItems: z.array(z.string()).describe('An array of identified food items in the image.'),
    }),
  },
  prompt: `You are an expert food identifier.

You will use this information to identify the food items in the image.

Identify all the food items present in this image.

Image: {{media url=photoDataUri}}`,
});

const identifyFoodItemsFlow = ai.defineFlow<
  typeof IdentifyFoodItemsInputSchema,
  typeof IdentifyFoodItemsOutputSchema
>(
  {
    name: 'identifyFoodItemsFlow',
    inputSchema: IdentifyFoodItemsInputSchema,
    outputSchema: IdentifyFoodItemsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
