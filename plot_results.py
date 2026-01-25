import numpy as np
import matplotlib.pyplot as plt

def plot_training():
    try:
        lengths = np.load("training_lengths.npy")
    except FileNotFoundError:
        print("No training data found.")
        return

    plt.figure(figsize=(10, 6))
    
    # Moving average
    window = 50
    if len(lengths) > window:
        ma = np.convolve(lengths, np.ones(window)/window, mode='valid')
        plt.plot(np.arange(window-1, len(lengths)), ma, label=f'{window}-Game Moving Average')
    
    plt.plot(lengths, alpha=0.3, label='Game Length')
    plt.title("Zehntausend Agent Training Progress")
    plt.xlabel("Episode")
    plt.ylabel("Steps per Game")
    plt.legend()
    plt.grid(True)
    
    plt.savefig("training_plot.png")
    print("Saved training_plot.png")

if __name__ == '__main__':
    plot_training()
