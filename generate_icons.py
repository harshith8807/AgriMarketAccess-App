from PIL import Image
import os

def generate_icons():
    # Create images directory if it doesn't exist
    if not os.path.exists('static/images'):
        os.makedirs('static/images')
    
    # List of required sizes
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    # Open the original logo
    try:
        original = Image.open('static/images/logo.png')
    except FileNotFoundError:
        print("Error: logo.png not found in static/images/ directory")
        return
    
    # Generate icons for each size
    for size in sizes:
        # Resize the image
        resized = original.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save the icon
        icon_path = f'static/images/icon-{size}x{size}.png'
        resized.save(icon_path, 'PNG')
        print(f"Generated {icon_path}")

if __name__ == "__main__":
    generate_icons() 