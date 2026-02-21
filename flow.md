## Outfit Generation Pipeline

This system converts user-uploaded photos into personalized outfit recommendations using computer vision and feedback-driven learning.

### Overview

The pipeline ingests user outfit photos, decomposes them into individual clothing items, processes them through a vision and fashion modeling stack, and continuously improves recommendations using user feedback.

### Workflow

1. **User Input**
   - User uploads photos:
     - OOTD (Outfit of the Day)
     - Normal daily outfits

2. **Item Extraction**
   - Photos are decomposed into individual clothing items (tops, bottoms, etc.).

3. **Image Processing**
   Each extracted item goes through:
   - Background removal
   - Image segmentation
   - Clothing classification

4. **Fashion Modeling**
   - Processed items are passed into a fashion model.
   - The model generates outfit-level embeddings and combinations.

5. **Outfit Storage**
   - Generated outfits are stored for reuse and recommendation serving.

6. **User Feedback**
   - Users provide feedback via left / right swipe interactions.
   - Feedback represents preference and fit quality.

7. **Learning Loop**
   - Feedback is used for reinforcement learning.
   - The system adapts recommendations to user taste over time.

8. **Liked Fits**
   - Liked outfits are persisted as user preferences.
   - Storage backend: Supabase (S3-compatible storage).

9. **User Confirmation**
   - Users confirm selected outfits before finalization.

10. **Final Output**
    - Drape: final outfit visualization or rendered output.

### Key Characteristics

- Modular vision pipeline (segmentation, classification)
- Feedback-driven personalization
- Persistent preference memory
- Scalable outfit and asset storage