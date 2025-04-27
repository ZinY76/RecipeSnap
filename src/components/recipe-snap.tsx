
"use client";

import React, { useState, useRef, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { identifyFoodItems, type IdentifyFoodItemsOutput } from "@/ai/flows/identify-food";
import { generateRecipe, type GenerateRecipeOutput } from "@/ai/flows/generate-recipe";
import { Camera, ChefHat, ImageUp, Loader2, UtensilsCrossed, AlertCircle, XCircle } from "lucide-react"; // Added XCircle
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export function RecipeSnap() {
  const [identifiedItems, setIdentifiedItems] = useState<string[]>([]);
  const [recipe, setRecipe] = useState<GenerateRecipeOutput | null>(null);
  const [loadingIdentify, setLoadingIdentify] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentDataUri, setCurrentDataUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // Added state for camera permission
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Effect to handle camera permission and stream setup
  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Stop stream immediately if camera is not meant to be shown initially
        if (!showCamera && videoRef.current && videoRef.current.srcObject) {
           const currentStream = videoRef.current.srcObject as MediaStream;
           currentStream.getTracks().forEach(track => track.stop());
           videoRef.current.srcObject = null;
         }

      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        // Toast is shown when trying to start camera explicitly
      }
    };

    // Only request permission if needed, avoid requesting on initial load unless camera tab starts active
     if (showCamera || hasCameraPermission === null) {
        getCameraPermission();
     }

    // Cleanup function to stop tracks when component unmounts or showCamera becomes false
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]); // Rerun when showCamera changes


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setPreviewUrl(dataUri);
        setCurrentDataUri(dataUri);
        setIdentifiedItems([]);
        setRecipe(null);
        setShowCamera(false); // Hide camera if a file is uploaded
        stopCamera(); // Ensure camera is stopped if active
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setPreviewUrl(null); // Clear file preview
    setCurrentDataUri(null);
    setIdentifiedItems([]);
    setRecipe(null);
     if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
    setShowCamera(true); // Set state to show camera

    if (hasCameraPermission === false) {
       toast({
         variant: 'destructive',
         title: 'Camera Access Denied',
         description: 'Please enable camera permissions in your browser settings to use this feature.',
       });
       setShowCamera(false); // Don't show camera UI if permission denied
       return;
    }

    // Re-request permission if it wasn't granted before or status unknown
     if (hasCameraPermission !== true) {
       try {
         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
         setHasCameraPermission(true);
         if (videoRef.current) {
           videoRef.current.srcObject = stream;
         }
       } catch (err) {
         console.error("Error accessing camera:", err);
         setHasCameraPermission(false);
         toast({
           variant: 'destructive',
           title: 'Camera Access Denied',
           description: 'Could not access the camera. Please ensure permissions are granted and reload.',
         });
         setShowCamera(false);
       }
     } else if (videoRef.current && !videoRef.current.srcObject) {
        // If permission exists but stream isn't set (e.g., after stopping), get it again
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
             console.error("Error re-accessing camera:", err);
             setHasCameraPermission(false); // Update state if access fails now
             toast({
               variant: 'destructive',
               title: 'Camera Access Error',
               description: 'Failed to re-activate the camera.',
             });
             setShowCamera(false);
        }
     }
  };


  const stopCamera = () => {
     // No need to update showCamera state here, it's handled by tab changes or capture/clear
     if (videoRef.current && videoRef.current.srcObject) {
       const stream = videoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(track => track.stop());
       videoRef.current.srcObject = null; // Ensure srcObject is cleared
     }
  };


  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        setPreviewUrl(dataUri);
        setCurrentDataUri(dataUri);
        setIdentifiedItems([]);
        setRecipe(null);
        setShowCamera(false); // Hide camera view after capture
        stopCamera(); // Stop camera stream
      }
    } else {
       toast({ title: "Camera Not Ready", description: "Please wait for the camera feed to load.", variant: "destructive" });
    }
  };


  const handleIdentify = async () => {
    if (!currentDataUri) {
      toast({ title: "No Image", description: "Please upload an image or take a photo first.", variant: "destructive" });
      return;
    }
    setLoadingIdentify(true);
    setIdentifiedItems([]); // Clear previous items
    setRecipe(null); // Clear previous recipe
    try {
      const result: IdentifyFoodItemsOutput = await identifyFoodItems({ photoDataUri: currentDataUri });
      setIdentifiedItems(result.foodItems || []);
      if (!result.foodItems || result.foodItems.length === 0) {
         toast({ title: "No Food Found", description: "Could not identify any food items in the image.", variant: "default" }); // Changed to default variant
      }
    } catch (error) {
      console.error("Error identifying food:", error);
      toast({ title: "Identification Error", description: "Failed to identify food items.", variant: "destructive" });
    } finally {
      setLoadingIdentify(false);
    }
  };

  const handleGenerateRecipe = async () => {
     if (!currentDataUri) {
      toast({ title: "No Image Data", description: "Cannot generate recipe without image data.", variant: "destructive" });
      return;
    }
    setLoadingRecipe(true);
    setRecipe(null); // Clear previous recipe
    try {
      const result: GenerateRecipeOutput = await generateRecipe({ photoDataUri: currentDataUri });
       if (!result || !result.recipeName || !result.ingredients || !result.instructions) {
         throw new Error("Invalid recipe format received from AI.");
       }
      setRecipe(result);
    } catch (error) {
      console.error("Error generating recipe:", error);
      toast({ title: "Recipe Generation Error", description: "Failed to generate recipe.", variant: "destructive" });
    } finally {
      setLoadingRecipe(false);
    }
  };

   const handleClearImage = () => {
    setPreviewUrl(null);
    setCurrentDataUri(null);
    setIdentifiedItems([]);
    setRecipe(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
    setShowCamera(false); // Ensure camera view is hidden
    stopCamera(); // Ensure camera is stopped
    toast({ title: "Image Cleared", description: "Image and results have been reset.", variant: "default" });
  };

  return (
    <Card className="w-full shadow-lg rounded-lg overflow-hidden bg-card">
      <CardHeader className="bg-primary text-primary-foreground p-6">
        <CardTitle className="text-3xl font-bold flex items-center gap-2"><ChefHat size={32}/> MyRecipeSnap</CardTitle>
        <CardDescription className="text-primary-foreground/80">Upload a photo or use your camera to identify food and get a recipe!</CardDescription>
      </CardHeader>
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Input Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2"><ImageUp size={24} /> Image Input</h3>
           <Tabs defaultValue="upload" className="w-full" onValueChange={(value) => {
             if (value === 'upload') {
                setShowCamera(false);
                stopCamera();
             } else {
                startCamera();
             }
            }}>
             <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-md">
               <TabsTrigger value="upload" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-sm">Upload a File</TabsTrigger>
               <TabsTrigger value="camera" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-sm">Capture with Camera</TabsTrigger>
             </TabsList>
             <TabsContent value="upload" className="mt-4">
                <div className="space-y-2">
                  <Label htmlFor="picture" className="text-sm font-medium">Upload an image</Label>
                  <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="file:text-foreground"/>
                </div>
             </TabsContent>
              <TabsContent value="camera" className="mt-4 space-y-4">
                {/* Video element always rendered for ref stability */}
                <video ref={videoRef} playsInline muted autoPlay className={`w-full h-auto rounded-md border bg-muted ${!showCamera ? 'hidden' : ''}`}></video>

                {/* Show camera controls only when camera should be active */}
                {showCamera && (
                  <div className="flex justify-center gap-2">
                    <Button onClick={capturePhoto} variant="outline" size="sm" className="bg-secondary hover:bg-secondary/90" disabled={hasCameraPermission !== true}>
                      <Camera className="mr-2 h-4 w-4" /> Capture Photo
                    </Button>
                    <Button onClick={() => { setShowCamera(false); stopCamera(); }} variant="ghost" size="sm"> {/* More explicit cancel */}
                       Cancel
                    </Button>
                  </div>
                )}

                {/* Show alert if permission is denied AND camera tab is active but camera isn't showing */}
               {hasCameraPermission === false && showCamera && (
                   <Alert variant="destructive">
                       <AlertCircle className="h-4 w-4" />
                       <AlertTitle>Camera Access Required</AlertTitle>
                       <AlertDescription>
                         Camera access was denied or is unavailable. Please enable it in your browser settings.
                       </AlertDescription>
                   </Alert>
                )}
                 {/* Informative message when camera tab is selected but permission not yet granted/denied */}
                {hasCameraPermission === null && showCamera && (
                    <Alert variant="default">
                         <AlertCircle className="h-4 w-4" />
                       <AlertTitle>Awaiting Camera Permission</AlertTitle>
                       <AlertDescription>
                         Please allow camera access in your browser prompt.
                       </AlertDescription>
                   </Alert>
                )}
                {/* Hidden canvas for capturing photo */}
               <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
              </TabsContent>
           </Tabs>

           {previewUrl && (
             <div className="mt-4 border rounded-lg overflow-hidden shadow-inner bg-muted/50 p-2 space-y-2">
               <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-60 object-contain rounded-md" />
                <Button onClick={handleClearImage} variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10 border-destructive/50" disabled={!currentDataUri || loadingIdentify || loadingRecipe}>
                   <XCircle className="mr-2 h-4 w-4" />
                   Clear Image
                </Button>
             </div>
           )}

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button onClick={handleIdentify} disabled={loadingIdentify || loadingRecipe || !currentDataUri} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {loadingIdentify ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />}
              Identify Food
            </Button>
             <Button onClick={handleGenerateRecipe} disabled={loadingRecipe || loadingIdentify || !currentDataUri} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {loadingRecipe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChefHat className="mr-2 h-4 w-4" />}
              Generate Recipe
            </Button>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Identified Items */}
           <div>
             <h3 className="text-xl font-semibold text-foreground mb-2">Identified Items</h3>
             <Card className="bg-secondary/30 border-dashed border-secondary shadow-none">
               <CardContent className="p-4 min-h-[80px]">
                {loadingIdentify && <Skeleton className="h-4 w-3/4 mb-2" />}
                 {identifiedItems.length > 0 ? (
                   <ul className="list-disc list-inside text-foreground space-y-1">
                     {identifiedItems.map((item, index) => (
                       <li key={index}>{item}</li>
                     ))}
                   </ul>
                 ) : (
                   !loadingIdentify && <p className="text-muted-foreground text-sm">{!currentDataUri ? 'Upload an image or capture a photo to start.' : 'No items identified yet. Click "Identify Food".'}</p>
                 )}
               </CardContent>
             </Card>
           </div>

           {/* Generated Recipe */}
           <div>
             <h3 className="text-xl font-semibold text-foreground mb-2">Generated Recipe</h3>
              <Card className="bg-secondary/30 border-dashed border-secondary shadow-none">
               <CardContent className="p-4 min-h-[200px]">
                 {loadingRecipe ? (
                   <div className="space-y-3">
                     <Skeleton className="h-6 w-1/2" />
                     <Skeleton className="h-4 w-1/4" />
                     <Skeleton className="h-4 w-3/4" />
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-2/3" />
                   </div>
                 ) : recipe ? (
                   <ScrollArea className="h-[300px] pr-4">
                     <div className="space-y-4">
                       <h4 className="text-lg font-semibold text-primary">{recipe.recipeName}</h4>
                       <div>
                         <h5 className="font-medium mb-1 text-foreground">Ingredients:</h5>
                         <ul className="list-disc list-inside text-foreground space-y-1 text-sm">
                           {recipe.ingredients.map((ingredient, index) => (
                             <li key={index}>{ingredient}</li>
                           ))}
                         </ul>
                       </div>
                       <div>
                         <h5 className="font-medium mb-1 text-foreground">Instructions:</h5>
                         <ol className="list-decimal list-inside text-foreground space-y-1 text-sm">
                           {recipe.instructions.map((instruction, index) => (
                             <li key={index}>{instruction}</li>
                           ))}
                         </ol>
                       </div>
                     </div>
                   </ScrollArea>
                 ) : (
                   <p className="text-muted-foreground text-sm">{!currentDataUri ? 'Upload an image or capture a photo first.' : identifiedItems.length === 0 ? 'Identify food items first, then click "Generate Recipe".' : 'Click "Generate Recipe" to get cooking instructions.'}</p>
                 )}
               </CardContent>
             </Card>
           </div>
        </div>
      </CardContent>
       <CardFooter className="p-4 bg-muted/50 text-center text-xs text-muted-foreground border-t">
          Powered by AI. Recipes are suggestions and may need adjustments. Always ensure food safety.
       </CardFooter>
    </Card>
  );
}
